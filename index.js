require("dotenv").config();

const express = require("express");
const cors = require("cors");
const app = express();

const dns = require("dns");

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());

app.use("/public", express.static(`${process.cwd()}/public`));

let mongoose = require("mongoose");
console.log("connecting to mongodb @ " + process.env.MONGO_URI);

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let UrlSchema = new mongoose.Schema({
  original_url: String,
  dns_address: {
    type: String,
    unique: true,
  },
  short_url: String,
});

let Url = mongoose.model("url_collection", UrlSchema);

const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/", function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

// Your first API endpoint
app.get("/api/hello", function (req, res) {
  res.json({ greeting: "hello API" });
});

const ERROR_RESPONSE = { error: 'invalid url' }

async function dnsLookup(url) {
  return new Promise(async (resolve, reject) => {
    console.log("***********\ndnsLookup()\n***********");
    console.log('Path parameter URL = "' + url + '"');

    if (url.includes("https://")) {
      url = url.substring(8);
      console.log("(url contains https://)");
    }
    if (url.includes("http://")) {
      url = url.substring(7);
      console.log("url contains http://");
    }
    if (url == "" || url == undefined || url == null) {
      console.log("Empty url: {" + url + "}");
      reject(ERROR_RESPONSE);
    }
    if (url.includes("/?")) {}
    
    if (url.includes("ftp:")) {
      console.log("Unsupported protocol: " + url);
      reject(ERROR_RESPONSE);
    }

    let options = {}
    options.all = true;

    await dns.lookup(url, (err, addr) => {    
      if (!err || addr != undefined) {
        console.log("DNS lookup sucessfull, address: ");
        console.log(addr);
        resolve(addr);
      }

      console.error("DNS lookup failed");
      console.error("Error: " + err);
      reject(ERROR_RESPONSE);
    });
  });
}

app.post("/api/shorturl/:id", async function (req, res) {
  let url = req.body.url;
  let id = req.params.id;
  let queryParams = req.query.v;

  console.log("*** POST " + url + ", id=" + id + ", params=" + queryParams);

  dnsLookup(url)
    .then((addr) => {
      console.log("dns promise resolved, addr: " + addr);
      address = addr;
    })
    .then(async () => {
      await Url
        .find({ dns_address: address })
        .count()
        .exec()
        .then(async (count) => {
          console.log("Existing items in database count = ");
          console.log(count);

          if (count > 0) {
            console.log("Item already in database");
            await Url
              .findOne({ dns_address: address })
              .exec()
              .then((doc) => {
                console.log("Document from database = ")
                console.log(doc);
                let obj = {
                  original_url: doc.get("original_url"),
                  short_url: doc.get("short_url"),
                };

                return res.json(obj);
              });
          } else {
            console.log("Item not in the database");

            let numberOfElements;
            Url
              .findOne()
              .count()
              .exec()
              .then((count) => count)
              .then(async (d) => {
                // urlObj = {
                //   original_url: url,
                //   dns_address: address,
                //   short_url: ++d,
                // };
                let msg = new Url({ original_url: url, dns_address: address, short_url: ++d });
                await msg
                  .save()
                  .then((doc) => {
                    console.log('Saving item to database')
                    console.log(doc);
                    return res.json({
                      original_url: doc.original_url,
                      short_url: doc.short_url,
                    });
                  })
                  .catch((err) => {
                    console.log("Writing to database error")
                    console.error(err)
                  });
              });
          }
        })
        .catch((err) => {
          console.log("Item lookup error");
          console.error("Error: " + err);
          return res.json(ERROR_RESPONSE);
        });
    })
    .catch((err) => {
      console.log("dnsLookup catch block (promise rejected)");
      console.error(err);
      return res.json(ERROR_RESPONSE);
    });
});

app.get("/api/shorturl/:urlId", (req, res) => {
  console.log(`**** GET /api/shorturl/:urlId, id=${req.params.urlId}`)
  const id = req.params.urlId;

  if (id !== null && id !== 'undefined') {
    Url
      .findOne({ short_url: id })
      .exec()
      .then((doc) => {
        console.log(doc)
        console.log("URL id found in database " + doc);
        let address = doc.get("original_url");
        if (address != null) {
          if (!address.includes("https://")) {
            address = "https://" + address;
          }
          console.log("Redirecting to url: " + address);
          res.status(301).redirect(address);
        }
      })
      .catch((err) => {
        console.error(err);
        res.json({ error: "Cannot get the specified url from database" });
      });
  }
});

app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});
