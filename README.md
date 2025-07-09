# NeMo.bil demo

To use the demo define the variables in the .env file. Do not use quotation marks:

```
PASSWORD=pswrd123     #correct
PASSWORD="pswrd123"   #wrong
```

### Local use with Node

To use the website locally without docker make sure you have all the packages installed and to use Node 20 or higher.

Then use `npm run build` in the `frontend` folder and `node server.js` in `backend`.

The website should be available on `http://localhost:${BACKEND_PORT}`


### Local use with Docker


To use the website locally with docker use `docker-compose build` in the repository root and then `docker-compose up`.

The website should be available on `http://localhost:${FRONTEND_PORT}`


