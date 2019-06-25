if (((Splunk.util.getCurrentView() == "arista_log_alerts") || (Splunk.util.getCurrentView() == "arista_status")) && Splunk.Module.SimpleResultsTable) {
    Splunk.Module.SimpleResultsTable = $.klass(Splunk.Module.SimpleResultsTable, {
        onResultsRendered: function($super) {
		var retVal = $super();

		$("tr:has(td)", this.container).each(function() {
	                var tr = $(this);

			l1 = tr.find("td:nth-child(2)");
			l2 = tr.find("td:nth-child(3)");
			l3 = tr.find("td:nth-child(4)");
			l4 = tr.find("td:nth-child(5)");
			l5 = tr.find("td:nth-child(6)");
			l6 = tr.find("td:nth-child(7)");
			l7 = tr.find("td:nth-child(8)");

			// hack, only do these coloring on 1st table
			if (!l7.text()) return retVal;

			// switchname
			s = tr.find("td:nth-child(1)");
			s.removeClass("d");
			s.css({ "background-color": "#ffffff", "color": "#000000" });

			// emergency
			if (l1.text() > 0) {
				l1.css({ "background-color": "#ff0000", "color": "#ffffff", "text-align": "center", "font-weight": "bold" });
			} else {
				l1.css({ "background-color": "#ffffff", "text-align": "center", "font-weight": "bold" });
			}

			// alerts
			if (l2.text() > 3) {
				l2.css({ "background-color": "#ff0000", "color": "#ffffff", "text-align": "center", "font-weight": "bold" });
			} else if (l2.text() > 0) {
				l2.css({ "background-color": "#ff4040", "color": "#ffffff", "text-align": "center", "font-weight": "bold" });
			} else {
				l2.css({ "background-color": "#ffffff", "text-align": "center", "font-weight": "bold" });
			}

			// critical
			if (l3.text() > 6) {
				l3.css({ "background-color": "#ff0000", "color": "#ffffff", "text-align": "center", "font-weight": "bold" });
			} else if (l3.text() > 3) {
				l3.css({ "background-color": "#ff4040", "color": "#ffffff", "text-align": "center", "font-weight": "bold" });
			} else if (l3.text() > 0) {
				l3.css({ "background-color": "#ff8080", "color": "#000000", "text-align": "center", "font-weight": "bold" });
			} else {
				l3.css({ "background-color": "#ffffff", "text-align": "center", "font-weight": "bold" });
			}

			// errors
			if (l4.text() > 12) {
				l4.css({ "background-color": "#ff0000", "color": "#ffffff", "text-align": "center", "font-weight": "bold" });
			} else if (l4.text() > 6) {
				l4.css({ "background-color": "#ff4040", "color": "#ffffff", "text-align": "center", "font-weight": "bold" });
			} else if (l4.text() > 3) {
				l4.css({ "background-color": "#ff8080", "color": "#000000", "text-align": "center", "font-weight": "bold" });
			} else if (l4.text() > 0) {
				l4.css({ "background-color": "#ffbfbf", "color": "#000000", "text-align": "center", "font-weight": "bold" });
			} else {
				l4.css({ "background-color": "#ffffff", "text-align": "center", "font-weight": "bold" });
			}

			// warnings
			if (l5.text() > 24) {
				l5.css({ "background-color": "#ff0000", "color": "#ffffff", "text-align": "center", "font-weight": "bold" });
			} else if (l5.text() > 18) {
				l5.css({ "background-color": "#ff4040", "color": "#ffffff", "text-align": "center", "font-weight": "bold" });
			} else if (l5.text() > 12) {
				l5.css({ "background-color": "#ff8080", "color": "#000000", "text-align": "center", "font-weight": "bold" });
			} else if (l5.text() > 6) {
				l5.css({ "background-color": "#ffbfbf", "color": "#000000", "text-align": "center", "font-weight": "bold" });
			} else if (l5.text() > 0) {
				l5.css({ "background-color": "#ffe6e6", "color": "#000000", "text-align": "center", "font-weight": "bold" });
			} else {
				l5.css({ "background-color": "#ffffff", "text-align": "center", "font-weight": "bold" });
			}

			// notifications
			if (l6.text() > 0) {
				l6.css({ "background-color": "#e3e3e3", "text-align": "center", "font-weight": "bold" });
			} else {
				l6.css({ "background-color": "#ffffff", "text-align": "center" });
			}

			// informational
			if (l7.text() > 0) {
				l7.css({ "background-color": "#eeeeee", "text-align": "center", "font-weight": "bold" });
			} else {
				l7.css({ "background-color": "#ffffff", "text-align": "center" });
			}

		});

		return retVal;
        }
     });
}

