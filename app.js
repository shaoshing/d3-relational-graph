'use strict';

var express = require('express');
var app = express();
app.set('port', (process.env.PORT || 3000));

app.use(express.static(__dirname + '/examples'));

app.listen(app.get('port'), function() {
  console.log('Node app is running at localhost:' + app.get('port'));
});
