// server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// run this script with 
// node server.js

// move getToken to proxy for security
// add a credentials file to read from
// add trip proposal and other calls to proxy


// Enable CORS for your frontend (adjust origin as needed)
app.use(cors({
    origin: '*', // your frontend origin
    methods: ['GET', 'POST'],
  }));
app.use(express.json());
const frontend_path = path.resolve(__dirname, '../frontend/dist');
app.use(express.static(frontend_path));



// Proxy requests to Stellio API

app.get('/app/get_token', async (req, res) => {
  const client_id = process.env.CLIENT_ID;
  const client_secret = process.env.CLIENT_SECRET;
  const grant_type = process.env.GRANT_TYPE;
  const scope = process.env.SCOPE;
  const username = process.env.USERNAME;
  const password = process.env.PASSWORD;

  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

  const urlencoded = new URLSearchParams();
  urlencoded.append("client_id", client_id);
  urlencoded.append("client_secret", client_secret);
  urlencoded.append("grant_type", grant_type);
  urlencoded.append("scope", scope);
  urlencoded.append("username", username);
  urlencoded.append("password", password);

  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: urlencoded,
    redirect: "follow"
  };

  try {
    const response = await fetch("https://idm.nemobil.cloud/auth/realms/nemobil/protocol/openid-connect/token", requestOptions);

    // Check response status
    if (response.status !== 200) {
      throw new Error(`Token request failed with status ${response.status}`);
    }
    const data = await response.text();
    res.status(response.status).send(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send('Proxy server error');
  }

  try {
      const response = await fetch(`https://api.nemobil.cloud/stellio/api/ngsi-ld/v1/entities/urn:ngsi-ld:TripRequest:${trip_id}`, {
      method: 'GET',
      headers: {
          'Link': req.headers['link'],
          'fiware-service': req.headers['fiware-service'],
          'Authorization': req.headers['authorization']
      }
      });

      const data = await response.text();
      res.status(response.status).send(data);
  } catch (error) {
      console.error('Proxy error:', error);
      res.status(500).send('Proxy server error');
  }
});

app.post('/app/post_trip', async (req, res) => {
    try {
        const response = await fetch('https://api.nemobil.cloud/stellio/api/ngsi-ld/v1/entities/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers['authorization'], // Forward token
            'Link': req.headers['link'],
            'fiware-service': req.headers['fiware-service']
        },
        body: JSON.stringify(req.body)
        });

        const data = await response.text(); // Stellio may return plain text on error
        res.status(response.status).send(data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).send('Proxy server error');
    }
});


app.get('/app/get_trip_request/:trip_id', async (req, res) => {
    const trip_id = req.params.trip_id;

    try {
        const response = await fetch(`https://api.nemobil.cloud/stellio/api/ngsi-ld/v1/entities/urn:ngsi-ld:TripRequest:${trip_id}`, {
        method: 'GET',
        headers: {
            'Link': req.headers['link'],
            'fiware-service': req.headers['fiware-service'],
            'Authorization': req.headers['authorization']
        }
        });

        const data = await response.text();
        res.status(response.status).send(data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).send('Proxy server error');
    }
});

app.get('/app/get_trip_proposal/:trip_id', async (req, res) => {
    const trip_id = req.params.trip_id;
    const maxRetries = 5;
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
    const makeRequest = async (attempt = 1) => {
      try {
        const response = await fetch(
          `https://api.nemobil.cloud/stellio/api/ngsi-ld/v1/entities/?type=TripProposal&q=request==urn:ngsi-ld:TripRequest:${trip_id}`,
          {
            method: 'GET',
            headers: {
              'Link': req.headers['link'],
              'fiware-service': req.headers['fiware-service'],
              'Authorization': req.headers['authorization']
            }
          }
        );
  
        const data = await response.text();
        console.log(`Get Trip Proposal - Attempt ${attempt}:`, response.status);
  
        // If data is an empty array, retry (if attempts remain)
        if (data.trim() === '[]' && attempt < maxRetries) {
          console.log(`Empty result, retrying in 1 second... (Attempt ${attempt + 1})`);
          await delay(1000);
          return await makeRequest(attempt + 1);
        }
  
        // Return final response
        res.status(response.status).send(data);
  
      } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).send('Proxy server error');
      }
    };
    makeRequest();
  });

app.post('/app/confirm_trip', async (req, res) => {
    try {
        const response = await fetch('https://api.nemobil.cloud/stellio/api/ngsi-ld/v1/entities/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers['authorization'], // Forward token
            'Link': req.headers['link'],
            'fiware-service': req.headers['fiware-service']
        },
        body: JSON.stringify(req.body)
        });

        const data = await response.text(); // Stellio may return plain text on error
        res.status(response.status).send(data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).send('Proxy server error');
    }
});

app.get('/app/get_trip/:trip_id', async (req, res) => {
    // const trip_id = req.params.trip_id;

    // try {
    //     const response = await fetch(`https://api.nemobil.cloud/stellio/api/ngsi-ld/v1/entities/urn:ngsi-ld:Trip:${trip_id}`, {
    //     method: 'GET',
    //     headers: {
    //         'Link': req.headers['link'],
    //         'fiware-service': req.headers['fiware-service'],
    //         'Authorization': req.headers['authorization']
    //     }
    //     });

    //     const data = await response.text();
    //     res.status(response.status).send(data);
    // } catch (error) {
    //     console.error('Proxy error:', error);
    //     res.status(500).send('Proxy server error');
    // }

    const trip_id = req.params.trip_id;
    const maxRetries = 5;
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
    const makeRequest = async (attempt = 1) => {
      try {
        const response = await fetch(`https://api.nemobil.cloud/stellio/api/ngsi-ld/v1/entities/urn:ngsi-ld:Trip:${trip_id}`, {
            method: 'GET',
            headers: {
                'Link': req.headers['link'],
                'fiware-service': req.headers['fiware-service'],
                'Authorization': req.headers['authorization']
            }
            });
  
        const data = await response.text();
        console.log(`Get Trip - Attempt ${attempt}:`, response.status);
  
        // If data is an empty array, retry (if attempts remain)
        if (response.status !== 200 && attempt < maxRetries) {
          await delay(500);
          return await makeRequest(attempt + 1);
        }
        // Return final response
        res.status(response.status).send(data);
  
      } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).send('Proxy server error');
      }
    };
    makeRequest();
});

app.get('/app/get_vehicle/:vehicle_id', async (req, res) => {
    const vehicle_id = req.params.vehicle_id;

    try {
        const response = await fetch(`https://api.nemobil.cloud/stellio/api/ngsi-ld/v1/entities/${vehicle_id}`, {
        method: 'GET',
        headers: {
            'Link': req.headers['link'],
            'fiware-service': req.headers['fiware-service'],
            'Authorization': req.headers['authorization']
        }
        });

        const data = await response.text();
        res.status(response.status).send(data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).send('Proxy server error');
    }
});

app.get('/app/hello', (req, res) => {
    res.json({ message: "Hello from backend" });
  });

// server.js or app.js
app.get('/config', (req, res) => {
  res.json({
    API_URL: process.env.API_URL || 'yo_mama_default',
  });
});

app.listen(PORT, () => {
  console.log(`Proxy server running at http://localhost:${PORT}`);
});