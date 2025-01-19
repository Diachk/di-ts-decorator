import { castToError } from "../../castToError";

import { Importer } from "./ComponentLoader";

const Log = console;

export class NoCircularDependencyLoader<K, V> {
  private cache = new Map<K, V>();
  private currentlyCreating: K[] = [];

  constructor(private importer: Importer<K, V>) {}

  public load(key: K): V {
    if (this.currentlyCreating.length === 0) {
      return this.loadModuleHandleErrors(key);
    }
    return this.loadModule(key);
  }

  private loadModuleHandleErrors(key: K): V {
    try {
      return this.loadModule(key);
    } catch (throwable) {
      const error = castToError(throwable);
      const currentPath = this.currentlyCreating
        .map((key) => this.stringify(key))
        .join(" -> ");
      this.currentlyCreating.splice(0);
      throw Error(`Failed to import [${currentPath}] because ${String(error)}`);
    }
  }

  private assertNoCircularDependency(key: K): void {
    // track circular dependencies
    if (this.currentlyCreating.filter((v) => v === key).length > 1) {
      throw Error(`Circular dependency detected.`);
    }
  }

  private stringify(key: K): string {
    if (typeof key === "string") {
      return key;
    }
    if (typeof key === "function") {
      return key.name;
    }

    return "" + key;
  }

  private loadModule(key: K): V {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    // If the service was not yet initialized, initialize the service
    Log.debug(`Creating service instance: "${this.stringify(key)}".`);
    this.currentlyCreating.push(key);
    this.assertNoCircularDependency(key);
    const dependency = this.importer.import(key, this);
    this.currentlyCreating.pop();
    this.cache.set(key, dependency);
    return dependency;
  }
}
