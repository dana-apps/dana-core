# dana-core

Tools for processing and accessing different information types

Executables can be downloaded from https://github.com/commonknowledge/dana-core/releases

## Developer quickstart

Nothing unorthodox here. Clone, run yarn to install dependencies and `yarn start` to run everything.

If you use vscode, you can optionally clone and run this repository in a development container. The GUI is accessible over vnc on port 5901 (password: vscode).

## Developer how-tos:

### Code structure

We have three high-level areas.

- `src/app` – Backend code, running in a nodejs or 'electron main' environment lives here.
- `src/frontend` – Frontend code, running in a browser or 'electron renderer' environment lives here.
- `src/common` – Environment-agnostic code lives here.

In general, try to keep both frontend and backend code separate from anything electron specifc – if you must use
electron APIs, wrap them in an API that could be used (or disabled) in non-electron environments.

The backend is subdivided into domain areas (asset, media, etc). Try to keep the interfaces between these relatively
minimal and document them well. In particular, avoid making state changes in one domain that implicitly affect another
(for example via database cascades).

### Interfaces

The general patttern for communication between domains and between the app and its frontend is to have an interface
file in `src/common/*.interfaces.ts`.

These should generally have a schema declaration associated with them (we use [zod](https://github.com/colinhacks/zod)
for schema validation) so that client-server environments can do data validation easily. Zod provides

### IPC

We abstract communication between the frontend and backend into the `FrontendIpc` interface, which can support
both electron's asynchronous message-passing paradigm and http.

This supports dispatching 'pubsub' events from the backend to the frontend and RPC-style calls. The `RpcInterface` and
`EventInterface` types are used to identify specifc RPC calls and events in a typesafe way.

These are documented in `src/common/ipc.interfaces.ts`.
See also examples in the other `src/common/*.interface.ts` files.

### Generating migrations

Archives store their metadata in sqlite documents. We use [MikroORM](mikro-orm.io/) as an ORM to simplify this, which
bundles [Umzug](https://www.npmjs.com/package/umzug) for managing schema migrations. It's fairly straightforward, but
please pay attention to its concept of a '[unit of work](https://mikro-orm.io/docs/unit-of-work)' if that is new to you.

Migrations can be auto-generated from entities (assuming the entity files follow the file naming convention of
`*entity.ts`). To do this, run `yarn make-migrations`.

Please do make sure that you squash any new migrations in your branch before opening a PR in order to keep them
managable.

## Release workflow

To cut a new release:

- When the version is ready to test, increment the version number in package.json
- [Draft a new release](https://help.github.com/articles/creating-releases/). Set the “Tag version” to the value of version in package.json, and prefix it with v. “Release title” should be the same as the tag version.
- For example, if package.json version is 1.0, your draft’s “Tag version” and “Release title” would be v1.0.
- Push some commits. Every CI build will update the artifacts attached to this draft.
- Once you are done, publish the release. GitHub will tag the latest commit for you.
