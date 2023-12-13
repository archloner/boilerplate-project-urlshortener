import { Router } from 'express';

const serverless = require('serverless-http')

const express = require('express');
const cors = require('cors');
const app = express();

const dns = require('dns')

require('dotenv').config();

let router = Router();
app.use('/api', router);


let mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_REMOTE_URI, { useNewUrlParser: true, useUnifiedTopology: true })

let UrlSchema = new mongoose.Schema({
  original_url: String,
  dns_address: {
    type: String,
    unique: true
  },
  short_url: Number
});

let model = mongoose.model('urlshortener-collection', UrlSchema);

const bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({extended: false}))

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());

app.use('/public', express.static(`${process.cwd()}/public`));

// router.get('/', function(req, res) {
//   res.sendFile(process.cwd() + '/views/index.html');
// });

// Your first API endpoint
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

let urlId = 1;

function save(url) {
  let saved = localStorage.setItem(urlId, url);
  const savedId = urlId;
  urlId++;
  return savedId;
}

function get(urlId) {
  return localStorage.getItem(urlId);
}

router.post('/api/shorturl', function(req, res, next) {
  // Middleware
  next();
}, function(req, res) {
  const url = req.body.url;
  dns.lookup(url, (err, addresses) => {

    if (err == null) {
      console.log('dns lookup successfull')
      console.log(addresses)
      
      model.find({'dns_address': addresses}).count().exec()
        .then(count => {
          console.log(count)
          if (count > 0) {
            console.log('Item already in database')
            
            let obj;

            model.find({ 'dns_address': addresses }).exec()
              .then(doc => {
                console.log(doc[0].get('original_url'))
                obj = {original_url: doc[0].get('original_url'), short_url: doc[0].get('short_url')}
                
                res.json(obj);
                return;
              })
            
          } else {
            console.log('Item not in the database')

            let numberOfElements;
            model.find()
              .count().exec()
              .then((count) => numberOfElements = count)
              .then(d => {
                urlObj = {'original_url': url, 'dns_address': addresses, 'short_url': ++numberOfElements}
                let msg = new model(urlObj);
                msg.save()
                  .then((doc) => {
                    res.json({ 'original_url': urlObj.original_url, 'short_url': urlObj.short_url });
                    return;
                  })
                  .catch(err => console.error(err))
              });
          }
        })
        .catch(err => {
          console.log('Item not in the database');
          console.error(err)
        });
 
    } else {
      console.log('error while dns lookup')
      console.log(err)
      res.json({'error': 'URL not valid'});
    }
    return;
  });
})

router.get('/api/shorturl/:urlId', (req, res) => {
  console.log(req.params.urlId);
  const id = req.params.urlId;
  if (id != null) {
    model.find({ 'short_url': id }).exec()
      .then((doc) => {
        console.log('URL id found in database');
        let address = doc[0].get('original_url')
        if (address != null) {
          if (!address.includes('https://')) {
            address = 'https://' + address;
          }
          console.log('Redirecting to url: ' + address)
          res.status(301).redirect(address);
        }
      })
      .catch(err => {
        console.error(err);
        res.json({ error: 'Cannot get the specified url from database'})
      })
  }
})

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});

export const handler = serverless(app);