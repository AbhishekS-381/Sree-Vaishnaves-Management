var express = require("express");
var bodyParser = require("body-parser");
var app = express();
require('dotenv').config();
const router = require('./routes');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set('views', './src/view');
app.use(express.static(__dirname + '/public'));

app.use(router);

app.listen(process.env.PORT, function () {
  console.log("server is running on port " + process.env.PORT);
});

