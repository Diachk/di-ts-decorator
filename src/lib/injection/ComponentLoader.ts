import { NodeRequireFacade } from "../../facade/require";
import { ComponentName, ExportSyntax } from "../registry";

export type ConstructorType<T> = new (...args: any) => T;

interface Getter<K, V> {
  (key: K): V;
}

interface ComponentLocator {
  locate(key: ComponentName): [ExportSyntax, string];
}

export interface ModuleLoader<K, V> {
  load(key: K): V;
}

export interface Importer<K, V> {
  import(key: K, loader: ModuleLoader<K, V>): V;
}

export class LkComponentLoader<V> {
  constructor(
    private readonly locator: ComponentLocator,
    private readonly getDependencies: Getter<
      ConstructorType<V>,
      ComponentName[]
    >,
    private readonly require: NodeRequireFacade,
  ) {}

  /**
   * Import a component either by name or by class reference.
   *
   * @param key    name or class of the component
   * @param loader A loader to resolve the dependencies of `key`
   */
  import(
    key: ComponentName | ConstructorType<V>,
    loader: ModuleLoader<typeof key, V>,
  ): V {
    if (typeof key === "function") {
      const dependencies = this.getDependencies(key).map((dependency) =>
        loader.load(dependency),
      );
      return new key(...dependencies);
    }

    const [syntax, path] = this.locator.locate(key);

    if (syntax === "exports") {
      return this.require.import<V>(path);
    }

    if (syntax === "export_default") {
      return this.require.importDefault<V>(path);
    }

    if (syntax === "export_default_class") {
      const esClass = this.require.importDefault<ConstructorType<V>>(path);
      const dependencies = this.getDependencies(esClass).map((dependency) =>
        loader.load(dependency),
      );
      return new esClass(...dependencies);
    }

    throw Error(`Unknown import syntax ${syntax}`);
  }
}
