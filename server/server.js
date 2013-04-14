var dgram = Npm.require('dgram'); // UDP/Datagram Sockets

// Write parsed data to mongodb
var insertLog = Meteor.bindEnvironment(function(msg, rinfo) {
  // When was this message received?
  var received = new Date().getTime();

  // Parse data from the string to a more useful format
  var parsed = Glossy.parse(msg);
  var data = msg.toString();

  console.log("server got: " + msg + " from " + rinfo.address + ":" + rinfo.port);

  log_entries.insert({client: parsed.host + ' (' + rinfo.address + ')',
                    received: received,
                    time: parsed.time,
                    facility: parsed.facility,
                    severity: parsed.severity,
                    message: parsed.message});

}, function(err) { console.log(err); });

// Syslog UDP Server
var Server = {
  listenIP: "0.0.0.0",
  port: 514,
  setUpSyslogUDPListener: function() {
    // Create a UDP server
    var server = dgram.createSocket("udp4");

    // Run once the server is bound and listening
    server.on("listening", function() {
      // Get the server's address information
      var addressInfo = server.address();

      // Update identifier, so it can be used for logging
      var identifier = addressInfo.address + ':' + addressInfo.port;

      console.log('Syslog UDP server is listening to ' + identifier);
    });

    server.on("message", insertLog);

    // If the syslog server socket is closed
    server.on("close", function() {
      console.log('Syslog UDP server socket closed');
    });

    // If the server catches an error
    server.on("error", function(exception) {
      console.log('Syslog UDP server caught exception: ' + exception);
    });

    // Next, we bind to the syslog port

    // If there is a listen IP, also give that to bind
    if(this.listenIP && this.listenIP!=='0.0.0.0' ) {
      server.bind(this.port, this.listenIP);

    // Otherwise, bind to all interfaces
    } else {
      server.bind(this.port);
    }
  }
};

Meteor.startup(function () {
  // code to run on server at startup
  Server.setUpSyslogUDPListener();
});

Meteor.publish('log_entries', function() {
  return log_entries.find();
});