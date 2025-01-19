import { Console } from "console";

/**
 * This is a global component registry where we can list components that need to be imported by name.
 * - It works along with the ComponentLocation, that indicates where these components will be loaded from.
 *
 * */
export interface ComponentRegistry {
  logger: typeof Console;
}
