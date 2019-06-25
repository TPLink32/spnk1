
def ensure_addon_lib_dir_in_path():
    import os
    import sys
    import os.path as op
    home = os.environ.get("SPLUNK_HOME", ".")
    app_name = [app_name for app_name in op.basename(__file__).split(".") if app_name.startswith("Splunk_TA_")][0]
    app_lib_dir = op.join(home, "etc", "apps", app_name, "appserver", "controllers")
    if app_lib_dir not in sys.path:
        sys.path.insert(0, app_lib_dir)

