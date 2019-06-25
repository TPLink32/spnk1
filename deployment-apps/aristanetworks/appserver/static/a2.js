
alert("rendering results");

if ((Splunk.util.getCurrentView() == "arista_status") && Splunk.Module.SimpleResultsTable) {
    Splunk.Module.SimpleResultsTable = $.klass(Splunk.Module.SimpleResultsTable, {
        onResultsRendered: function($super) {
		var retVal = $super();

		alert("rendering results");
		$("tr:has(td)", this.container).each(function() {
	                var tr = $(this);

			l1 = tr.find("td:nth-child(2)");
			l2 = tr.find("td:nth-child(3)");
			l3 = tr.find("td:nth-child(4)");
			l4 = tr.find("td:nth-child(5)");
			l5 = tr.find("td:nth-child(6)");
			l6 = tr.find("td:nth-child(7)");
			l7 = tr.find("td:nth-child(8)");

			// emergency
			if (l1.text() > 0) {
				l1.addClass("sev1");
			}

			// alerts
			if (l2.text() > 3) {
				l2.addClass("sev1");
			} else if (l2.text() > 0) {
				l2.addClass("sev2");
			}

			// critical
			if (l3.text() > 6) {
				l3.addClass("sev1");
			} else if (l3.text() > 3) {
				l3.addClass("sev2");
			} else if (l3.text() > 0) {
				l3.addClass("sev3");
			}

			// errors
			if (l4.text() > 12) {
				l4.addClass("sev1");
			} else if (l4.text() > 6) {
				l4.addClass("sev2");
			} else if (l4.text() > 3) {
				l4.addClass("sev3");
			} else if (l4.text() > 0) {
				l4.addClass("sev4");
			}

			// warnings
			if (l5.text() > 24) {
				l5.addClass("sev1");
			} else if (l5.text() > 18) {
				l5.addClass("sev2");
			} else if (l5.text() > 12) {
				l5.addClass("sev3");
			} else if (l5.text() > 6) {
				l5.addClass("sev4");
			} else if (l5.text() > 0) {
				l5.addClass("sev5");
			}

			// notifications and informational
			if (l6.text() > 0) {
				l6.addClass("gray1");
			}
			if (l7.text() > 0) {
				l7.addClass("gray2");
			}

		}

		return retVal;
        }
     });
}

