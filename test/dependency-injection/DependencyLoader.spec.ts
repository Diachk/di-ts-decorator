import "mocha";
import * as assert from "assert";

import * as sinon from "sinon";

import { NoCircularDependencyLoader } from "../../src/lib/injection/NoCircularDependencyLoader";

type Loader = NoCircularDependencyLoader<unknown, unknown>;

describe("No circular dependency loader", () => {
  describe("Expectations", () => {
    it("expects importer to throw when a location does not exist", function () {
      const locator = { import: sinon.stub().throws("Module not found") };

      const loader = new NoCircularDependencyLoader<unknown, unknown>(locator);
      const load = () => loader.load("utils");

      assert.throws(load, /Failed to import \[utils] because Module not found/);
      assert.deepStrictEqual(locator.import.firstCall.firstArg, "utils");
    });

    it("expects importer to return a module when the module exists", function () {
      const locator = { import: sinon.stub().returns({ name: "Test" }) };

      const loader = new NoCircularDependencyLoader<unknown, unknown>(locator);
      const result = loader.load("utils");

      assert.deepStrictEqual(result, { name: "Test" });
      assert.deepStrictEqual(locator.import.firstCall.firstArg, "utils");
    });
  });

  describe("Behaviour", () => {
    describe("import legacy services", () => {
      it("should detect direct circular dependencies", function () {
        const locator = {
          import: sinon
            .stub()
            .callsFake((_key: unknown, loader: Loader) => loader.load("utils")),
        };

        const loader = new NoCircularDependencyLoader<unknown, unknown>(
          locator,
        );
        const load = () => loader.load("utils");

        assert.throws(
          load,
          /Failed to import \[utils -> utils] because Error: Circular dependency detected/,
        );
      });

      it("should detect indirect circular dependencies", function () {
        const locator = { import: sinon.stub() };
        locator.import
          .withArgs("utils", sinon.match.object)
          .callsFake((_key: unknown, loader: Loader) => loader.load("auth"));
        locator.import
          .withArgs("auth", sinon.match.object)
          .callsFake((_key: unknown, loader: Loader) => loader.load("user"));
        locator.import
          .withArgs("user", sinon.match.object)
          .callsFake((_key: unknown, loader: Loader) => loader.load("auth"));

        const loader = new NoCircularDependencyLoader<unknown, unknown>(
          locator,
        );
        const load = () => loader.load("utils");

        assert.throws(
          load,
          /Failed to import \[utils -> auth -> user -> auth] because Error: Circular dependency detected/,
        );
      });

      it("should not load the same module twice", function () {
        const locator = { import: sinon.stub() };
        locator.import
          .withArgs("utils", sinon.match.object)
          .returns({ name: "utils" });

        const loader = new NoCircularDependencyLoader<unknown, unknown>(
          locator,
        );
        const result1 = loader.load("utils");
        const result2 = loader.load("utils");

        assert.deepStrictEqual(result1, { name: "utils" });
        assert.deepStrictEqual(result2, { name: "utils" });
        assert.strictEqual(result1, result2);
        assert.deepStrictEqual(locator.import.calledOnce, true);
        assert.deepStrictEqual(locator.import.firstCall.firstArg, "utils");
      });
    });

    describe("import classes", () => {
      it("should detect direct circular dependencies", function () {
        class Utils {
          name = "utils";
        }
        const locator = {
          import: sinon
            .stub()
            .callsFake((_key: unknown, loader: Loader) => loader.load(Utils)),
        };

        const loader = new NoCircularDependencyLoader<unknown, unknown>(
          locator,
        );
        const load = () => loader.load(Utils);

        assert.throws(
          load,
          /Failed to import \[Utils -> Utils] because Error: Circular dependency detected/,
        );
      });

      it("should detect indirect circular dependencies", function () {
        class Utils {
          name = "utils";
        }
        class Auth {
          name = "auth";
        }
        class User {
          name = "user";
        }

        const locator = { import: sinon.stub() };
        locator.import
          .withArgs(Utils, sinon.match.object)
          .callsFake((_key: unknown, loader: Loader) => loader.load(Auth));
        locator.import
          .withArgs(Auth, sinon.match.object)
          .callsFake((_key: unknown, loader: Loader) => loader.load(User));
        locator.import
          .withArgs(User, sinon.match.object)
          .callsFake((_key: unknown, loader: Loader) => loader.load(Auth));

        const loader = new NoCircularDependencyLoader<unknown, unknown>(
          locator,
        );
        const load = () => loader.load(Utils);

        assert.throws(
          load,
          /Failed to import \[Utils -> Auth -> User -> Auth] because Error: Circular dependency detected/,
        );
      });

      it("should not load the same module twice", function () {
        class Utils {
          name = "utils";
        }
        const locator = { import: sinon.stub() };
        locator.import.withArgs(Utils).returns(new Utils());

        const loader = new NoCircularDependencyLoader<unknown, unknown>(
          locator,
        );
        const result1 = loader.load(Utils);
        const result2 = loader.load(Utils);

        assert.deepStrictEqual(result1, new Utils());
        assert.deepStrictEqual(result2, new Utils());
        assert.strictEqual(result1, result2);
        assert.deepStrictEqual(locator.import.calledOnce, true);
        assert.deepStrictEqual(locator.import.firstCall.firstArg, Utils);
      });
    });

    describe("error handling", () => {
      it("should handle errors in an idempotent way", function () {
        const locator = { import: sinon.stub().throws("Module not found") };
        const loader = new NoCircularDependencyLoader<unknown, unknown>(
          locator,
        );
        const load = () => loader.load("utils");

        // The assertion is invoked twice here, in order to check that the internal state
        // of the loader is not left with an inconsistency after the first error.
        assert.throws(
          load,
          /Failed to import \[utils] because Module not found/,
        );
        assert.throws(
          load,
          /Failed to import \[utils] because Module not found/,
        );
      });
    });
  });
});
