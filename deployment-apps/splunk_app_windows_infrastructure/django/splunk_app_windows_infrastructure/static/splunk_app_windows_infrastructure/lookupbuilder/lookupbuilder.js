define(function(require, exports, module) {
    var LookupBuilderDialog = require('common/CustomPages/AppSetupPages/LookupBuilderDialog');
    var WinfraSetupConfig = require('splunk_app_windows_infrastructure/setup/AppSetupConfigs/WinfraSetupConfig');
    var SetupConfigManager = require('common/CustomPages/AppSetupPages/SetupConfigManager');
    
    SetupConfigManager.build(WinfraSetupConfig.get());
    LookupBuilderDialog.showLookupBuilderDialog(SetupConfigManager.getLookupBuilders());
});