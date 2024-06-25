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
  short_url: String,
});

let Url = mongoose.model("url_collection", UrlSchema);

const bodyParser = require("body-parser");
const { randomUUID } = require("crypto");
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/", function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

// Your first API endpoint
app.get("/api/hello", function (req, res) {
  res.json({ greeting: "hello API" });
});

const ERROR_RESPONSE = { error: "invalid url" };

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
    if (url.includes("/?")) {
    }

    if (url.includes("ftp:")) {
      console.log("Unsupported protocol: " + url);
      reject(ERROR_RESPONSE);
    }

    let options = {};
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

function validUrl(url) {
  if (url == "" || url == undefined || url == null) {
    console.log("Empty url: {" + url + "}");
    return false;
  }
  if (url.includes("ftp:")) {
    console.log("Unsupported protocol: " + url);
    return false;
  }

  return true;
}

app.post("/api/shorturl", async function (req, res) {
  let url = req.body.url;
  let id = req.params.id;
  let queryParams = req.query.v;

  console.log("*** POST " + url + ", id=" + id + ", params=" + queryParams);
  console.log(req.body)

  if (!validUrl(url)) {
    res.json(ERROR_RESPONSE);
    return;
  }

  let doc = new Url({
    original_url: url,
    short_url: randomUUID().substring(0, 6),
  });
  doc.save();

  res.json(doc);
});

app.get("/api/shorturl", (req, res) => {
  return res.json({ msg: "hello" });
});

app.get("/api/shorturl/:urlId", async (req, res) => {
  console.log(`*** GET /api/shorturl/:urlId, id=${req.params.urlId}`);
  const id = req.params.urlId;

  if (id === null || id === "undefined") {
    res.json(ERROR_RESPONSE);
  }

  try {
    let doc = await Url.findOne({ short_url: id });
    
    console.log(doc);
    console.log("URL id found in database " + doc);

    let address = doc.original_url;
    console.log(address);
    if (address != null) {
      console.log("Redirecting to url: " + address);
      res.status(301).redirect(address);
    }
  } catch (err) {
    console.error(err);
    res.json(ERROR_RESPONSE);
  }
});

app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});
