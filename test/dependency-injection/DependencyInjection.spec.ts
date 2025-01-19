import "mocha";
import * as assert from "assert";
import { getDependencies, inject } from "../../src/lib/injection/decorator";
import { Console } from "console";

// We need to stub functions with sinon, ignoring eslint rules only for this test file.
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
describe("dependency injection", () => {
  it("should register a constructor parameter", function () {
    @inject("logger")
    class Alert {
      constructor(public logger?: typeof Console) {}
    }
    assert.deepStrictEqual(getDependencies(Alert), ["logger"]);
  });

  it("should register multiple constructor parameters in order", function () {
    @inject("logger", "logger")
    class Alert {
      constructor(
        public logger: typeof Console,
        public configurationService?: typeof Console,
      ) {}
    }
    assert.deepStrictEqual(getDependencies(Alert), ["logger", "logger"]);
  });

  it("should allow direct class injection", function () {
    class Case {
      name = "case";
    }
    @inject(Case)
    class Alert {
      constructor(public caseService?: Case) {}
    }
    assert.deepStrictEqual(getDependencies(Alert), [Case]);
  });

  it("should allow direct class and service key injection in combination", function () {
    class GraphSchema {
      name = "case";
    }
    @inject("logger", GraphSchema)
    class Alert {
      constructor(
        public caseService?: typeof Console,
        public graphSchemaService?: GraphSchema,
      ) {}
    }
    assert.deepStrictEqual(getDependencies(Alert), ["logger", GraphSchema]);
  });
});
