'use strict';

define(['json!components/data/ShowcaseInfo.json', 'splunkjs/mvc/simplexml/controller', 'Options'], function (ShowcaseInfo, DashboardController, Options) {
    var roleKey = 'mlts-role';

    return {
        getRole: function getRole() {
            var roleName = localStorage.getItem(roleKey);
            // make sure we return the default role if it hasn't been defined in localStorage yet
            // for example, because the user went direct to a dashboard and has never loaded the contents.js since roles were implemented
            if (roleName == null) roleName = Options.getOptionByName('defaultRoleName');
            return roleName;
        },
        setRole: function setRole(role) {
            if (role != null) {
                localStorage.setItem(roleKey, role);
            } else {
                localStorage.deleteItem(roleKey);
            }
            return this.updateMenu();
        },
        updateMenu: function updateMenu() {
            var menuItemSelector = 'a[href*=' + '"' + DashboardController.model.app.get('app') + '/contents"' + ']';
            var menuItemText = '';

            var role = this.getRole();
            var roleDetails = ShowcaseInfo.roles[role];

            console.log("Got our Role Storage", role, roleDetails, ShowcaseInfo)

            if (role !== 'default' && roleDetails != null) {
                menuItemText = 'Use Cases (' + roleDetails.label + ')';
            } else {
                menuItemText = 'Use Cases';
            }
            console.log("Menu Text", menuItemText)
            $(menuItemSelector).text(menuItemText).attr('title', menuItemText);
        }
    };
});