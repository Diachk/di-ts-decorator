# di-ts-decorator

Dependency injection with TypeScript decorators

## Overview

`di-ts-decorator` is a lightweight library that simplifies dependency injection in TypeScript applications using decorators. It allows developers to easily manage dependencies and promote better code organization and testability.

## Features

- **Type-safe Dependency Injection**: Leverage TypeScript's type system for safer dependency management.
- **Decorator Support**: Use decorators to define and inject dependencies seamlessly.
- **Flexible Configuration**: Easily configure and customize the dependency injection container.

## Usage

Here are some examples of how to use `di-ts-decorator` for dependency injection:

### Registering a Constructor Parameter

You can register a constructor parameter using the `@inject` decorator:

```typescript
import { inject } from "di-ts-decorator";

@inject("logger")
class Alert {
  constructor(public logger?: typeof Console) {}
}

// Usage
const dependencies = getDependencies(Alert);
console.log(dependencies); // Output: ["logger"]
```

### Registering Multiple Constructor Parameters

You can also register multiple constructor parameters in order:

```typescript
import { inject } from "di-ts-decorator";

@inject("logger", "configurationService")
class Alert {
  constructor(
    public logger: typeof Console,
    public configurationService?: ConfigurationService,
  ) {}
}

// Usage
const dependencies = getDependencies(Alert);
console.log(dependencies); // Output: ["logger", "configurationService"]
```

### Direct Class Injection

You can inject a class directly:

```typescript
import { inject } from "di-ts-decorator";

class Case {
  name = "case";
}

@inject(Case)
class Alert {
  constructor(public caseService?: Case) {}
}

// Usage
const dependencies = getDependencies(Alert);
console.log(dependencies); // Output: [Case]
```

### Combining Direct Class and Service Key Injection

You can combine direct class injection with service key injection:

```typescript
import { inject } from "di-ts-decorator";

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

// Usage
const dependencies = getDependencies(Alert);
console.log(dependencies); // Output: ["logger", GraphSchema]
```
