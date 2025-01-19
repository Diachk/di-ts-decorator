import { FileLocations } from "../../utils/fileLocations";
import type { ComponentName, ComponentPath, ExportSyntax } from "./index";

export class ComponentLocations
  implements Record<ComponentName, ComponentPath>
{
  readonly alert = "export_default://server/services/alert" as const;
  readonly auth = "exports://server/services/auth" as const;
  readonly case = "exports://server/services/case" as const;
  readonly accessRights =
    "export_default://server/services/accessRights" as const;
  readonly email = "export_default://server/services/email" as const;
  readonly graphQuery = "export_default://server/services/graphQuery" as const;
  readonly graphSchema =
    "export_default://server/services/graphSchema" as const;
  readonly group = "export_default://server/services/group" as const;
  readonly logger = "export_default://services/logger" as const;
  readonly widget = "export_default://server/services/widget" as const;
  readonly configuration =
    "export_default://server/services/configuration" as const;
  readonly customFile = "export_default://server/services/customFile" as const;
  readonly errors = "export_default://server/services/errors" as const;
  readonly firstRun = "export_default://server/services/firstRun" as const;
  readonly plugins = "export_default://server/services/plugins" as const;
  readonly user = "export_default://server/services/user" as const;
  readonly data = "export_default://server/services/data" as const;
  readonly serviceManager = "exports://server/services/index" as const;
  readonly userCache =
    "export_default://server/services/auth/userCache" as const;

  static locate(key: ComponentName): [ExportSyntax, string] {
    const locator = new ComponentLocations();
    const [syntax, path] = locator[key].split("://");
    return [syntax as ExportSyntax, FileLocations.resolvePathFromRoot(path)];
  }
}
