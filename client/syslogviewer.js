//session based filter params for logs
Session.set("log_client", "raspberrypi (192.168.1.102)");
Session.set("log_entries_limit", 200);
Session.set("severity_filter", 'all');

Session.set("logs_filtered", null);

var logFilter = {};

Deps.autorun(function() {
  Meteor.subscribe('log_entries');
});

var filteredLogs = function() {
  var severity = Session.get("severity_filter");

  if(Session.equals('severity_filter', 'all')) {
    logFilter = {};
  } else {
    logFilter = {severity: severity};
  }

  return log_entries.find(logFilter, {sort: {received:-1}, limit: Session.get("log_entries_limit")});
};

Template.log.helpers({
  log_entries: function() {
    return Session.get("logs_filtered");
  }
});

////////// Severity Filter //////////

Template.filter.helpers({
  severities: function () {
    var severity_infos = [];

    severity_infos.push({severity: 'all'});

    _.each(SeverityIndex, function(severity){
      severity_infos.push({severity: severity});
    });

    return severity_infos;
  },

  severity: function () {
    return this.severity || "all";
  },

  selected: function () {
    return Session.equals('severity_filter', this.severity) ? 'selected' : '';
  }
});

Template.filter.events({
  'mousedown .severity': function () {
    if (Session.equals('severity_filter', this.severity))
      Session.set('severity_filter', 'all');
    else
      Session.set('severity_filter', this.severity);
  }
});

Template.chart_filter.rendered = function() {
  Deps.autorun(function () {
    console.log("updating crossfilter...");

    // retrieve all log entries
    var logs = filteredLogs().fetch();

    if(logs.length > 0) {
      // add date property to logs
      var firstDate = null, lastDate = null;
      for(var i = 0; i < logs.length; i++) {
        var rec = +logs[i].received;
        logs[i].date = new Date(rec);
        if(firstDate === null) {
          firstDate = new Date(rec);
          firstDate.setDate(firstDate.getDate() - 5);
        }
        lastDate = new Date(rec);
        lastDate.setDate(lastDate.getDate() + 5);
      }

      // Create the crossfilter for the relevant dimensions and groups.
      var log = crossfilter(logs),
          all = log.groupAll(),
          date = log.dimension(function(d) { return d3.time.day(d.date); }),
          dates = date.group(),
          hour = log.dimension(function(d) { return d.date.getHours() + d.date.getMinutes() / 60; }),
          hours = hour.group(Math.floor);

      var charts = [

        barChart()
            .dimension(date)
            .group(dates)
            .round(d3.time.day.round)
          .x(d3.time.scale()
            .domain([firstDate, lastDate])
            .rangeRound([0, 10 * 90]))
            .filter([firstDate, lastDate]),

        barChart()
            .dimension(hour)
            .group(hours)
          .x(d3.scale.linear()
            .domain([0, 24])
            .rangeRound([0, 10 * 24]))

      ];

      // Given our array of charts, which we assume are in the same order as the
      // .chart elements in the DOM, bind the charts to the DOM and render them.
      // We also listen to the chart's brush events to update the display.

      d3.selectAll("svg").remove();

      var chart = d3.select("#filter-charts").selectAll(".chart")
          .data(charts)
          .each(function(chart) { chart.on("brush", renderAll).on("brushend", renderAll); });

      renderAll();

      // Renders the specified chart or list.
      function render(method) {
        d3.select(this).call(method);
      }

      // Whenever the brush moves, re-rendering everything.
      function renderAll() {
        chart.each(render);

        Session.set("logs_filtered", _.sortBy(date.bottom(40), function(entry) { return entry.received; })
                                      .reverse());
      }

      window.filter = function(filters) {
        filters.forEach(function(d, i) { charts[i].filter(d); });
        renderAll();
      };

      window.reset = function(i) {
        charts[i].filter(null);
        renderAll();
      };
    }
  });
}