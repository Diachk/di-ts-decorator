import "reflect-metadata";
import type { ComponentRegistry } from "../registry/ComponentRegistry";
import { ComponentName } from "../registry";

const DEPENDENCIES = Symbol("DEPENDENCIES");
export type ConstructorType<T> = new (...args: any) => T;

export function getDependencies<
  K extends keyof ComponentRegistry,
  T extends NonNullable<unknown>,
>(target: T): K[] {
  return (Reflect.getMetadata(DEPENDENCIES, target) || []) as K[];
}

interface ClassDecorator<T> {
  (target: T): void;
}

type Component = ComponentName | ConstructorType<unknown>;

type D<T extends Component> = T extends ComponentName
  ? ComponentRegistry[T]
  : T extends ConstructorType<infer U>
    ? U
    : never;

/**
 * Definition of the class constructor
 * A: the list of components to inject
 * We map the element of the list with the parameter of the constructor of the class C, and add a length property
 * with the length of the list
 */
interface C<A extends Component[]> {
  // eslint-disable-next-line
  new (...a: { [K in keyof A]: D<A[K]> } & { length: A["length"] }): unknown;
}

/**
 * Definition of the inject class decorator, it takes a list of components (classes) as parameters
 * A: the list of components to inject
 * T: the class to inject the components into
 */
export function inject<A extends Component[], T extends C<A>>(
  ...component: [...A]
): ClassDecorator<T> {
  return (target: T) => Reflect.defineMetadata(DEPENDENCIES, component, target);
}
