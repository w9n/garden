# Hot reloading with Go example project

## Usage

To run the project with hot reloading enabled:

```sh
garden dev --hot=go-service
```

## Notes

1. Using [gin](https://github.com/codegangsta/gin) for hot reloading

2. Changed the app port from `8080` to `8081` since **gin** listens on `8080` and maps to `8081`

See here:

```go
// main.go
http.ListenAndServe(":8081", nil)
```

and here:

```sh
# Dockerfile
CMD gin -p 8080 -a 8081 --path webserver run main.go
```

3. Had to make some changes to how the Dockerfile `WORKDIR` was set due to an issue with the hot reloading copying mechanism. Doddi is working on it.