
type Constructor<Instance, Args extends any[]> = { new (...args: Args): Instance };
type _InstanceType<Constructor> = Constructor extends { new (...args: any[]): infer U } ? U : unknown;

type Union<Types extends any[]> = Types extends (infer T)[] ? T : unknown;

type EachInstanceType<Source> = {
  [Key in keyof Source]: _InstanceType<Source[Key]>;
};

interface HandleDescription {
  constructors: Constructor<any, any[]>[];
  handler: (error: any) => void;
}

export class ExceptionHandler {
  private _default?: (error: any) => void;
  private readonly _handles: HandleDescription[] = [];

  public setDefaultHandler(handler: (error: any) => void): this {
    this._default = handler;
    return this;
  }

  public addHandler<Constructors extends Constructor<any, any[]>[]>(handler: (error: Union<EachInstanceType<Constructors>>) => void, ...constructors: Constructors): this {
    if (constructors.length !== 0) {
      this._handles.push({
        constructors,
        handler
      });
    }
    return this;
  }

  public handle(error: any): void {
    const {_default, _handles} = this;
    for (const {constructors, handler} of _handles) {
      for (const ctor of constructors) {
        if (error instanceof ctor) {
          return handler(error);
        }
      }
    }
    if (_default) {
      return _default(error);
    }
    throw error;
  }
}
