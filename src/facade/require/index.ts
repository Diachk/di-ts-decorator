/**
 * A facade for NodeJs require.
 */
export class NodeRequireFacade {
  public import<V>(id: string): V {
    return require(id);
  }

  public importDefault<V>(id: string): V {
    return this.import<{ default: V }>(id).default;
  }
}
