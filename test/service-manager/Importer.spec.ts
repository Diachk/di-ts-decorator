import "mocha";
import * as assert from "assert";

import * as sinon from "sinon";
import { LkComponentLoader } from "../../src/lib/injection/ComponentLoader";

const key = "logger" as const;

// We need to stub functions with sinon, ignoring eslint rules only for this test file.
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
describe("Service resolver", () => {
  describe("behaviour", () => {
    it("should throw if a location does not exists", function () {
      const requireFacade = {
        import: sinon.stub(),
        importDefault: sinon.stub(),
      };
      const locator = sinon.stub().throws("Not exists");
      const dependencies = sinon.stub();
      const importerFactory = new LkComponentLoader(
        { locate: locator },
        dependencies,
        requireFacade,
      );

      const importer = () =>
        importerFactory.import(key, { load: sinon.stub() });

      assert.throws(importer, /Not exists/);
    });

    it("should throw if a module cannot be imported", function () {
      const requireFacade = {
        import: sinon.stub().throws("Not exists"),
        importDefault: sinon.stub(),
      };
      const locator = sinon.stub().returns(["exports", "hello"]);
      const dependencies = sinon.stub();
      const importerFactory = new LkComponentLoader(
        { locate: locator },
        dependencies,
        requireFacade,
      );

      assert.throws(
        () => importerFactory.import(key, { load: sinon.stub() }),
        /Not exists/,
      );
    });

    it("should import an existing module", function () {
      const requireFacade = {
        import: sinon.stub().returns({ name: "Test" }),
        importDefault: sinon.stub(),
      };
      const locator = sinon.stub().returns(["exports", "hello"]);
      const dependencies = sinon.stub();
      const importerFactory = new LkComponentLoader(
        { locate: locator },
        dependencies,
        requireFacade,
      );

      assert.deepStrictEqual(
        importerFactory.import(key, { load: sinon.stub() }),
        {
          name: "Test",
        },
      );
    });

    it("should import a CommonJs object", function () {
      const requireFacade = {
        import: sinon.stub().returns({ name: key }),
        importDefault: sinon.stub(),
      };
      const path = ["exports", "server/services/utils"];
      const locator = sinon.stub().withArgs(key).returns(path);
      const dependencies = sinon.stub();
      const importerFactory = new LkComponentLoader(
        { locate: locator },
        dependencies,
        requireFacade,
      );

      assert.deepStrictEqual(
        importerFactory.import(key, { load: sinon.stub() }),
        {
          name: key,
        },
      );
    });

    it("should import an ECMAScript object", function () {
      const requireFacade = {
        import: sinon.stub(),
        importDefault: sinon.stub().returns({ name: key }),
      };
      const path = ["export_default", "server/services/utils"];
      const locator = sinon.stub().withArgs(key).returns(path);
      const dependencies = sinon.stub();
      const importerFactory = new LkComponentLoader(
        { locate: locator },
        dependencies,
        requireFacade,
      );

      assert.deepStrictEqual(
        importerFactory.import(key, { load: sinon.stub() }),
        {
          name: key,
        },
      );
    });

    it("should import an instantiated ECMAScript class", function () {
      class Service {
        name = key;
      }
      const requireFacade = {
        import: sinon.stub(),
        importDefault: sinon.stub().returns(Service),
      };
      const path = ["export_default_class", "server/services/utils"];
      const locator = sinon.stub().withArgs(key).returns(path);
      const dependencies = sinon.stub().returns([]);
      const importerFactory = new LkComponentLoader(
        { locate: locator },
        dependencies,
        requireFacade,
      );

      assert.deepStrictEqual(
        importerFactory.import(key, { load: sinon.stub() }),
        new Service(),
      );
    });

    it("should import an instantiated ECMAScript class with dependencies", function () {
      class Dep {
        name = "auth";
      }
      class Service {
        name = key;
        constructor(public auth: Dep) {}
      }
      const requireFacade = {
        import: sinon.stub(),
        importDefault: sinon.stub().returns(Service),
      };
      const tree = ["export_default_class", "server/services/utils"];
      const locator = sinon.stub().withArgs(key).returns(tree);
      const authLoader = { load: sinon.stub().returns(new Dep()) };
      const dependencies = sinon.stub().returns(["auth"]);

      const importerFactory = new LkComponentLoader(
        { locate: locator },
        dependencies,
        requireFacade,
      );

      assert.deepStrictEqual(
        importerFactory.import(key, authLoader),
        new Service(new Dep()),
      );
    });

    it("should import an instantiated ECMAScript class when the key is the class itself", function () {
      class Service {
        name = key;
      }
      const requireFacade = {
        import: sinon.stub(),
        importDefault: sinon.stub().returns(Service),
      };
      const path = ["export_default_class", "server/services/utils"];
      const locator = sinon.stub().withArgs(key).returns(path);
      const dependencies = sinon.stub().returns([]);
      const importerFactory = new LkComponentLoader(
        { locate: locator },
        dependencies,
        requireFacade,
      );

      assert.deepStrictEqual(
        importerFactory.import(key, { load: sinon.stub() }),
        new Service(),
      );
    });
  });
});
