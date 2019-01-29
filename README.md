# Yucca - SB Hacks 5

## Local development

First you need to install [Node.js](http://nodejs.org/).

To run the app locally:

1. Clone this repository and `cd` into it

2. Install dependencies

    ```bash
    npm install -g yarn && \
    yarn install
    ```

3. Copy the sample configuration file and edit it to match your configuration

   ```bash
   $ cp .env .env.local
   ```
   You can find your `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` in your
   [Twilio Account Settings](https://www.twilio.com/console).
   You will also need a `TWILIO_PHONE_NUMBER`, which you may find [here](https://www.twilio.com/console/phone-numbers/incoming).

   Run `source .env.local` to export the environment variables

1. Run the application

    ```bash
    yarn start
    ```
    Alternatively you might also consider using [nodemon](https://github.com/remy/nodemon) for this. It works just like
    the node command but automatically restarts your application when you change any source code files.

    ```bash
    yarn global add nodemon && \
    nodemon index.js 
    ```

1. Check it out at [http://localhost:3000](http://localhost:3000)

That's it

## Run the tests

You can run the tests locally by typing

```bash
yarn test
```
