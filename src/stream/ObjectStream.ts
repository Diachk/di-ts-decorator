/**
 * LINKURIOUS CONFIDENTIAL
 * Copyright Linkurious SAS 2012 - 2019
 *
 * - Created on 2023-07-12.
 */
export interface Callback {
  (error: Error | null): void;
}

export interface Collector<T, U = unknown> {
  (data: T): U;
}

export type AsyncCollector<T> = Collector<T, Promise<unknown>>;

/**
 * An abstraction over the node.js `Readable` stream that allows to chain operations on the stream.
 */
export interface ObjectStream<T> {
  /**
   * Prematurely end the stream after `milliseconds` have elapsed.
   */
  timeout(milliseconds: number, error?: Error): ObjectStream<T>;

  /**
   * Register a one-time listener that will be synchronously called just before this stream is
   * closed.
   *
   * This is useful to monitor or log the time taken by the stream to be processed. The listener
   * receives the timestamp at which the stream started flowing (as the number of milliseconds
   * since Epoch).
   */
  once(event: 'close', listener: (streamingStartTime: number) => void): ObjectStream<T>;

  /**
   * Map every value of the stream to the value returned by `mapFn`.
   */
  map<U>(mapFn: (data: T) => Exclude<U, null>): ObjectStream<U>;

  /**
   * Slice the stream into chunks of the specified `size`.
   */
  chunk(size: number): ObjectStream<[T, ...T[]]>;

  /**
   * Ignore values from the stream for which a call to `isAllowed` does not return `true`.
   */
  filter(isAllowed: (data: T) => boolean): ObjectStream<T>;

  /**
   * Prematurely end the stream after processing `max` items.
   */
  limit(max: number, error?: Error): ObjectStream<T>;

  /**
   * Prematurely destroy the stream.
   */
  destroy(error?: Error, callback?: Callback): void;

  /**
   * Start reading data from the stream and return every item collected once the stream is completed.
   */
  collect(): Promise<T[]>;

  /**
   * Start reading data from the stream and call `collect` on every value.
   */
  collect(collect: AsyncCollector<T>): Promise<void>;

  collect(collect: Collector<T>): Promise<void>;

  collect(collect: Collector<T> | undefined): Promise<void | T[]>;
}
