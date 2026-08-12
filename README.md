![hero](./hero.jpg)
# web-tiger
This package contains Destiny `36735.13.12.02.1953.alpha` web services. It's available as both a standalone Nest server and a library imported by the Blam Network web services [`web_private`](https://github.com/Blam-Network/web_private). It includes:
- Sign-on server
- Ticket Server (Datamine)
- BAP TCP server
- Activity Host servers
- DemonWare 3.1 server

## Preparing the project

1. Install dependencies with the `npm install` command.
2. Create a `.env` file in the project root, following this structure:
    ```env
      BAP_SIGNON_IP=127.0.0.1
      BAP_SIGNON_PORT=37000
      # Optional: override sign-on ports (defaults 32000,32001,32004,32005,32008,32009)
      # SIGNON_HTTP_PORTS=32000,32001,32004,32005,32008,32009
      # HOSTNAME=
    ```

## Running the server

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

When running the server in Dev mode, you can configure the Reports Watcher to print your Destiny logs to the console.
See `reports_watch.example.json` for an example configuration.

---

Last Updated 11/08/26 by Codie 🐧
