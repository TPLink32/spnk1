The grayskull folder is an integrate from the code for the grayskull project located
in //splunk/solutions/splusplus/mainline/apps/grayskull.

This folder originally contained components we depended on in the grayskull project.
Most of the components are now completely refactored from the original direct integrates.
The list of features that were refactored largely:

1. deep dive lanes aka swim lanes with forllowing additional features:
    a) to support multiple lanes from a single shared search manager
    b) lane footer
    c) score display per lane
    d) custom menus per lane
    e) heatmap views with overlays for key events
2. Multirange vertical slider
