# Local Environment Setup

## Prerequisites

- Please install the most recent versions of docker and docker-compose for your
  operating system.
- Make sure that you have Node.js v18 installed on your machine. Alternatively, you can
  launch the application in the docker container. Please see the instructions below.

## Configuration

The repository contains an example of the .env file. Please use it to create a
configuration file:

```shell
cp .env.example .env
```

For the simplicity sake, you can use the values from the example file if they don't
conflict with your local environment.

## Running the application in the docker container

Please find the example of the docker-compose.override.yml file in the root of the
repository and use it to override the default configuration. It contains a definition of
the service that runs the application in the docker container.

```shell
cp docker-compose.override.example.yaml docker-compose.override.yaml
```

Make sure that the port mapping does not conflict with the ports used by other
applications on your machine.

## Other adjustments

Additionally, you may want to use a docker-compose.override.yml file to override the
default configuration than cannot be changed via environment variables, for example, the
main command to run in the container. Please refer to the
docker-compose.override.example.yml file for the example.

# Adding initial data

You can find the initial data in the "fixtures" folder. Execute the 001-initial-data.sql
script in your favorite database editor, e.g. pgaadmin or DataGrip. If you have postgres
client installed, you can run the following command:

```shell
psql -h localhost -p 5432 -U postgres -d dice_game -f fixtures/001-initial-data.sql
```

Adjust the port and the database name to make them match the values from your .env file.
