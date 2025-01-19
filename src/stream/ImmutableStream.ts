/**
 * LINKURIOUS CONFIDENTIAL
 * Copyright Linkurious SAS 2012 - 2020
 *
 * - Created on 2020-11-16.
 */
import {EventEmitter} from 'node:events';
import {PassThrough, pipeline, Readable, Writable} from 'node:stream';

import {castToError} from '../castToError';

import {ObjectStream, Callback, Collector, AsyncCollector} from './ObjectStream';

export interface Consumer<T, U> {
  (data: T, collect: Collector<U>, source: Readable): void;
}

export interface Collectible<T> {
  (collect: Collector<T>): void;
}

export interface Operation<T, U> {
  consume: Consumer<T, U>;
  flush: Collectible<U>;
}

export interface CloseFunction {
  (prematureClose: boolean, error?: Error): unknown;
}

export interface CloseableStream {
  stream: Readable | Readable[];
  close?: CloseFunction;
}

interface MergedCloseableStream {
  stream: Readable;
  close?: CloseFunction;
}

interface StreamSourceFn {
  (source: {timeoutMs?: number}): Promise<CloseableStream>;
}

const NOOP = async () => {};
const END = Symbol('end');

/**
 * A helper library that simplifies stream transform operations.
 * It has 3 components:
 * 1. A source stream
 * 2. A transform stream
 * 3. A collector
 *
 * Data flows from the source to the collector.
 * All transform operations are executed on each data chunk right before pushing them to the collector.
 * Data chunks are collected from the stream by calling .collect()
 * No data will start flowing in the stream until `.collect()` is called
 *
 *+-------------+       +----------------+
 *|source stream+------>+transform stream|
 *+-------------+       +----------------+
 *                      |                |
 *                      |  .map()        |
 *                      |                |
 *                      |  .filter()     |
 *                      |                |
 *                      |  .chunk()      |
 *                      |                |
 *                      |  .limit()      |        +----------+
 *                      |                +------->+.collect()|
 *                      +----------------+        +----------+
 *
 * A custom collector can be provided to the collect method, in which case `.collect()`
 * returns undefined after every data chunk has been consumed.
 *
 * If no collector is provided the data chunks will be buffered in memory and the entire result list
 * will be returned after the stream has completed.
 *
 * When instantiating ImmutableStream, a custom close function can be provided.
 * This function is guaranteed to be called in case of an error or after the last chunk of data
 * has been consumed but before `.collect()` is resolved. This gives you the opportunity to run any
 * necessary cleanup operation before the stream is destroyed.
 *
 * The stream is immutable because every transform operation generates a new stream.
 */
export class ImmutableStream<T> implements ObjectStream<T> {
  private readonly originalSource: StreamSourceFn;
  private source: StreamSourceFn | Promise<MergedCloseableStream>;
  private readonly operations: Operation<unknown, T>[];
  private highWaterMark?: number;
  private streamingStartTime?: number;
  private isDestroyed = false;
  private readonly timeoutMs?: number;
  private readonly timeoutError?: Error;
  private readonly eventEmitter: EventEmitter;

  private static isStreaming(
    source: StreamSourceFn | Promise<MergedCloseableStream>
  ): source is Promise<MergedCloseableStream> {
    return typeof source !== 'function';
  }

  static of<T>(source: StreamSourceFn): ObjectStream<T> {
    return new this<T>(source);
  }

  static fromArray<T>(array: T[]): ObjectStream<T> {
    return new this<T>(async () => ({stream: Readable.from(array)}));
  }

  static empty<T>(): ObjectStream<T> {
    return ImmutableStream.fromArray([]);
  }

  /**
   * Create a new ImmutableStream.
   *
   * `source` is guaranteed to not be called before .collect() is called.
   * This simplifies a lot the code
   *
   * @constructor
   */
  private constructor(
    source: StreamSourceFn,
    operations: Operation<unknown, T>[] = [],
    highWaterMark?: number,
    timeoutMs?: number,
    timeoutError?: Error,
    eventEmitter = new EventEmitter()
  ) {
    this.source = source;
    this.operations = operations;
    this.originalSource = source;
    this.highWaterMark = highWaterMark;
    this.timeoutMs = timeoutMs;
    this.timeoutError = timeoutError;
    this.eventEmitter = eventEmitter;
  }

  private newOperation<U>(
    source: StreamSourceFn,
    consume: Consumer<T, U>,
    flush: Collectible<U> = NOOP
  ): ObjectStream<U> {
    const newOperation = [
      ...this.operations,
      {consume: consume, flush: flush}
    ] as unknown as Operation<unknown, U>[];
    return new ImmutableStream(
      source,
      newOperation,
      this.highWaterMark,
      this.timeoutMs,
      this.timeoutError,
      this.cloneEventEmitter()
    );
  }

  /**
   * see {@link ObjectStream.timeout}
   */
  timeout(milliseconds: number, error?: Error): ObjectStream<T> {
    return new ImmutableStream(
      this.originalSource,
      this.operations,
      this.highWaterMark,
      milliseconds,
      error,
      this.cloneEventEmitter()
    );
  }

  /**
   * see {@link ObjectStream.once}
   */
  once(event: 'close', listener: (t0: number) => void): ObjectStream<T> {
    return new ImmutableStream(
      this.originalSource,
      this.operations,
      this.highWaterMark,
      this.timeoutMs,
      this.timeoutError,
      this.cloneEventEmitter().once(event, listener)
    );
  }

  private cloneEventEmitter(): EventEmitter {
    const newEventEmitter = new EventEmitter();
    for (const eventName of this.eventEmitter.eventNames()) {
      for (const listener of this.eventEmitter.listeners(eventName)) {
        newEventEmitter.addListener(eventName, listener as (...args: unknown[]) => void);
      }
    }
    return newEventEmitter;
  }

  /**
   * Map every value of the stream to the value returned by `mapFn`.
   */
  map<U>(mapFn: (data: T) => Exclude<U, null>): ObjectStream<U> {
    return this.newOperation(this.originalSource, (data, collect) => collect(mapFn(data)));
  }

  /**
   * Slice the stream into chunks of the specified `size`.
   */
  chunk(size: number): ObjectStream<[T, ...T[]]> {
    if (!Number.isInteger(size) || size <= 0) {
      throw Error('Invalid chunk size ' + size);
    }
    // HighWaterMark should be at least the size of the first chunk operation
    // This way the next chunk can be buffered in memory when the current chunk is being processed
    this.highWaterMark = this.highWaterMark || size;
    let buffer: T[] = [];
    return this.newOperation(
      this.originalSource,
      (data: T, collect) => {
        buffer.push(data);
        if (buffer.length >= size) {
          // We guarantee that the buffer is never empty by verifying that the size is higher than 0.
          collect(buffer as [T, ...T[]]);
          buffer = [];
        }
      },
      (collect) => {
        if (buffer.length > 0) {
          // We guarantee that the buffer is never empty by verifying that the size is higher than 0.
          collect(buffer as [T, ...T[]]);
        }
      }
    );
  }

  /**
   * Ignore values from the stream for which a call to `isAllowed` does not return `true`.
   */
  filter(isAllowed: (data: T) => boolean): ObjectStream<T> {
    return this.newOperation(this.originalSource, (data: T, collect) => {
      if (isAllowed(data)) {
        collect(data);
      }
    });
  }

  /**
   * Prematurely end the stream after processing `max` items.
   */
  limit(max: number, error?: Error): ObjectStream<T> {
    let emits = 0;
    let aborted = max < 1;
    return this.newOperation(this.originalSource, (data: T, collect, source) => {
      if (!aborted) {
        if (++emits >= max) {
          aborted = true;
        }
        collect(data);
      } else {
        source.emit(END, error);
      }
    });
  }

  /**
   * Prematurely destroy the stream.
   */
  destroy(error?: Error, callback: Callback = NOOP): void {
    // If the stream was already destroyed, do nothing
    if (this.isDestroyed) {
      return callback(error || null);
    }
    this.isDestroyed = true;
    if (ImmutableStream.isStreaming(this.source)) {
      void Promise.resolve(this.source)
        .then(({stream, close = NOOP}) => {
          if (error) {
            stream.emit('error', error);
          }
          // The destroy method of through stream does not support the error argument. TODO: remove support for through streams (unused)
          // Emitting an error, then destroy with no error is equivalent with calling destroy(error)
          stream.destroy();
          return Promise.resolve()
            .then(() => this.eventEmitter.emit('close', this.streamingStartTime))
            .then(() => close(true, error))
            .catch((closingError: unknown) => {
              error = castToError(closingError);
            })
            .finally(() => {
              callback(error || null);
            });
        })
        .catch(() => {
          /**
           * Ignore this error to avoid an uncaught application exception.
           * An error here most likely means that "this.source" is a rejected promise, i.e. that the
           * promise function returning the source stream(s) rejected.
           */
        });
    }
  }

  /**
   * Start reading data from the stream and return every item collected once the stream is completed.
   */
  collect(): Promise<T[]>;
  /**
   * Start reading data from the stream and call `collect` on every value.
   */
  collect(collect: AsyncCollector<T>): Promise<void>;
  collect(collect: Collector<T>): Promise<void>;
  collect(collect: Collector<T> | undefined = NOOP): Promise<void | T[]> {
    if (this.isDestroyed) {
      return Promise.reject(Error('You cannot collect a destroyed stream.'));
    }
    if (ImmutableStream.isStreaming(this.source)) {
      return Promise.reject(Error('You can only collect a stream once'));
    }
    let timer: NodeJS.Timeout | undefined;
    if (this.timeoutMs) {
      timer = setTimeout(() => {
        this.destroy(this.timeoutError);
      }, this.timeoutMs);
    }
    const operations = this.operations;
    this.streamingStartTime = Date.now();
    this.source = this.source({timeoutMs: this.timeoutMs})
      .then((source) => {
        return {
          stream: ImmutableStream.merge(source.stream),
          close: source.close
        };
      })
      .finally(() => {
        // clear the first timeout as soon as the source promise is resolved (or rejected).
        if (timer) {
          clearTimeout(timer);
        }
      });

    return this.source.then(({stream, close = NOOP}) => {
      if (this.timeoutMs && timer) {
        // start a new timer once the streams are resolved to count from when they start flowing
        timer = setTimeout(() => {
          stream.emit(END, this.timeoutError);
        }, this.timeoutMs);
      }
      return new Promise((resolve, reject) => {
        let finalResultBuffer: T[];
        if (collect === NOOP) {
          finalResultBuffer = [];
          collect = (data) => {
            finalResultBuffer.push(data);
          };
        }
        const consumer = new Writable({
          objectMode: true,
          autoDestroy: true,
          highWaterMark: this.highWaterMark,
          write: function (data: T, encoding: string, callback: Callback) {
            const buffer: T[] = [];
            const collector = (data: T) => buffer.push(data);
            try {
              ImmutableStream.pipeSync(data, operations, collector, stream);
              ImmutableStream.collectSequentially(collect, buffer, callback);
            } catch (throwable) {
              callback(castToError(throwable));
            }
          },
          writev: function (chunks: Array<{chunk: T; encoding: string}>, callback: Callback) {
            const buffer: T[] = [];
            const collector = (data: T) => buffer.push(data);
            try {
              chunks.forEach((data) =>
                ImmutableStream.pipeSync(data.chunk, operations, collector, stream)
              );
              ImmutableStream.collectSequentially(collect, buffer, callback);
            } catch (throwable) {
              callback(castToError(throwable));
            }
          },
          final: function (callback: Callback) {
            const buffer: T[] = [];
            const collector = (data: T) => buffer.push(data);
            try {
              ImmutableStream.flushSync(operations, collector, stream);
              ImmutableStream.collectSequentially(collect, buffer, callback);
            } catch (throwable) {
              callback(castToError(throwable));
            }
          },
          destroy: function (error: Error | null, callback: Callback) {
            if (error) {
              this.emit('error', error);
            }
            callback(error);
          }
        });

        let prematureClose = false;
        stream.on(END, (error?: Error) => {
          stream.unpipe?.(consumer);
          // Since Node v14.0.0 the pipeline function will wait for the 'close' event
          // on all streams before invoking the callback if no error occurred
          // see https://github.com/nodejs/node/blob/b34a9d7dd88b6d717448e0ff433158c845f2f309/lib/internal/streams/pipeline.js#L167
          // The readable stream will not emit a close event until it has ended.
          // Therefore, in the case of a premature close, the callback `onStreamEnd` is never called
          // To fix this issue we call onStreamEnd ourselves after we finish writing every data chunk
          consumer.end(() => onStreamEnd(error || null));
          prematureClose = true;
        });

        let isEndOfStream = false;
        const onStreamEnd = (error: Error | null) => {
          if (isEndOfStream) {
            return;
          }
          isEndOfStream = true;
          if (timer) {
            // the stream is done, we can clear the timeout timer.
            clearTimeout(timer);
          }
          // Since Node v14.0.0 the pipeline function does not destroy readable streams
          // that did not emit an end event. // see https://github.com/nodejs/node/blob/b34a9d7dd88b6d717448e0ff433158c845f2f309/lib/internal/streams/pipeline.js#L167
          // Here we make sure that both producer and consumer are destroyed.
          // Note that it is safe to call destroy multiple times. Only the first call has an effect.
          stream.destroy();
          consumer.destroy();
          if (this.isDestroyed) {
            // Avoid closing the stream a second time if the stream was already destroyed.
            // This situation is guaranteed to happen when the stream is destroyed before it has completed.
            return error && !ImmutableStream.isPrematureClose(error)
              ? reject(error)
              : resolve(finalResultBuffer);
          } else if (!error || ImmutableStream.isPrematureClose(error)) {
            Promise.resolve()
              .then(() => this.eventEmitter.emit('close', this.streamingStartTime))
              .then(() => close(prematureClose))
              .then(() => resolve(finalResultBuffer))
              .catch(reject);
          } else {
            this.destroy(error, reject);
          }
        };

        pipeline(stream, consumer, onStreamEnd);
        // Always pipe before resuming to avoid data loss
        // The stream.resume() method can be used to fully consume the data from a stream
        // without actually processing any of that
        // https://nodejs.org/api/stream.html#stream_readable_resume
        stream.resume();
      });
    });
  }

  private static isPrematureClose(error: Error & {code?: string}): boolean {
    return error.code === 'ERR_STREAM_PREMATURE_CLOSE' || error.message === 'Premature close';
  }

  /**
   * Asynchronously call `collect` on every value then call `cb` when all collections are resolved.
   */
  private static collectSequentially<T>(collect: Collector<T>, values: T[], cb: Callback): void {
    if (values.length) {
      let p: Promise<unknown> = Promise.resolve();
      values.forEach((v) => {
        p = p.then(() => collect(v));
      });
      p.then(() => cb(null), cb);
    } else {
      cb(null);
    }
  }

  /**
   * Synchronously execute `consume` from all `operations` on `value`.
   * The output of one operation becomes the input of the next.
   */
  private static pipeSync<T, U>(
    value: T,
    operations: Operation<T, U>[],
    collect: Collector<U>,
    source: Readable
  ): void {
    const queue: Array<T | U> = [value];
    const collector = (data: U) => queue.push(data);
    for (const operation of operations) {
      const size = queue.length;
      for (let i = 0; i < size; i++) {
        operation.consume(queue[i] as T, collector, source);
      }
      for (let i = 0; i < size; i++) {
        queue.shift();
      }
    }
    (queue as U[]).forEach(collect);
  }

  /**
   * Synchronously execute `flush` on all `operations`.
   * The output of one flush is consumed by the next operation.
   * The final output is consumed by `collect`
   */
  private static flushSync<T, U>(
    operations: Operation<T, U>[],
    collect: Collector<U>,
    stream: Readable
  ): void {
    const queue: U[] = [];
    const collector = (data: U) => queue.push(data);
    for (const operation of operations) {
      this._flushSync(queue, operation, collector, stream);
    }
    queue.forEach(collect);
  }

  /**
   * Synchronously execute `operation.flush` on every item of the queue.
   * And call `collect` on every item of the resulting queue.
   */
  private static _flushSync<T, U>(
    queue: Array<T | U>,
    operation: Operation<T, U>,
    collect: Collector<U>,
    stream: Readable
  ): void {
    const size = queue.length;
    for (let i = 0; i < size; i++) {
      operation.consume(queue[i] as T, collect, stream);
      queue.shift();
    }
    operation.flush(collect);
  }

  /**
   * Merge multiple readable streams into a single output stream.
   */
  private static merge<T extends Readable>(sources: T | T[]): Readable {
    const streams: Set<T> = new Set(Array.isArray(sources) ? sources : [sources]);
    if (streams.size === 1) {
      return Array.from(streams)[0];
    }
    const dest = new PassThrough({
      objectMode: true,
      destroy: (error: Error | null, callback: (error: Error | null) => void) => {
        streams.forEach((s) => s.destroy(error || undefined));
        callback(error);
      }
    });

    // NodeJs fires a warning when the number of event listeners of any type exceeds 10 (default)
    // https://nodejs.org/api/events.html#emittersetmaxlistenersn
    // We expect 1 listener for each call of source.pipe(dest)
    // +1 listener added because pipeline relies on pipe() https://github.com/nodejs/node/blob/657fb9a77ca36f729da484f55899dad7a13759b0/lib/internal/streams/pipeline.js#L241
    // +1 listener added by the pipeline own functions see https://github.com/nodejs/node/blob/v14.18.1/lib/internal/streams/pipeline.js
    // +1 listener added by the pipeline on Node v18
    dest.setMaxListeners(streams.size + 3);

    const end = (source: T) => () => {
      source.unpipe(dest);
      streams.delete(source);
      if (streams.size === 0 && dest.readable) {
        dest.push(null);
      }
    };

    for (const source of streams) {
      source.pipe(dest, {end: false});
      // When an error occurs in the source stream the destination stream is destroyed
      // but without emitting an error. This guarantees that the stream always emits an error
      source.on('error', (error) => dest.destroy(error));
      source.once('end', end(source));
    }

    return dest;
  }
}
