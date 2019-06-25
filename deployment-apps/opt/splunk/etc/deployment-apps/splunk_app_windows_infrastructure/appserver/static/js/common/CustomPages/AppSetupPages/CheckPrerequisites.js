/*
 * This file contains the code to implement the prerequisites page for setup.
 * It is assumed here that this page is implemented within a core wizard.
 */

define([
        'jquery',
        'underscore',
        'splunkjs/mvc',
        'common/CustomPages/AppSetupPages/SetupHelpers'
        ],
        function(
            $,
            _,
            mvc,
            SetupHelpers
            )
{   
    var CheckPrerequisites = {    
        _pageHeader: ' \
            <div id="pre-reqs-page" class="wizard-page-part"> \
                <table> \
                    <tr> \
                        <td> \
                            <h1>Prerequisites  <a \
                                id="redetect" class="btn btn-default icon-rotate" \
                                > Redetect</a> \
                            </h1> \
                            <p>Check prerequisites to be installed on the search head</p> \
                        </td> \
                    </tr> \
                </table> \
                <div id="bypass" >\
                    <input id="bypass-checkbox" type="checkbox"></input>\
                    <span><h5 class="inline-heading">Bypass pre-requisite checks</h5></span>\
                    <p>Note: bypassing prerequisites might result in reduced or limited app functionality</p>\
                </div>\
            </div>\
            </div> \
            ',
           
        _featureNotInstalledHtml: '\
            <p>Feature is not installed. \
                <a target="_blank">Install feature</a> \
            </p> \
            ',
    
        _localSplunkd: null,
        
        render: function(appName, appRequiredPrereqs, parentEl, pageStatusCallback) {
            var that = this;
            
            parentEl.html(this._pageHeader);
            
            this._appName = appName;
            this._parentEl = parentEl;
            this._appRequiredPrereqs = appRequiredPrereqs;
            this._pageStatusCallback = pageStatusCallback;
            
            this._runPrereqChecks();
            
            $('#redetect').on("click", function(event) {
                that._runPrereqChecks();
            });

            $('#bypass-checkbox').click(function() {
                that._bypassClicked($(this));
            });
        },
        
        _runPrereqChecks: function() {
            var that = this;
            
            this._localSplunkd = mvc.createService({'app': this._appName});
            
            this._prereqsMap = {
                'checkSplunkVersion': {
                    fn: this._checkSplunkVersion,
                    prereqSatisfied: false,
                    prereqChecker: this
                },
                'checkTAWindowsVersion': {
                    fn: this._checkTAWindowsVersion,
                    prereqSatisfied: false,
                    prereqChecker: this
                },
                'checkSALdapSearchVersion': {
                    fn: this._checkSALdapSearchVersion,
                    prereqSatisfied: false,
                    prereqChecker: this
                },
                'checkRequiredUserRole': {
                    fn: this._checkRequiredUserRole,
                    prereqSatisfied: false,
                    prereqChecker: this
                }
            }
            
            this._parentEl.find('.page-section').remove();
            
            _.each(this._appRequiredPrereqs, function(args, prereq) {
                that._prereqsMap[prereq]['fn'](that._parentEl, args);               
            });
        },
        
        arePrereqsSatisfied: function() {
            return this._prereqsPassed() || $('#bypass-checkbox').is(':checked');
        },
        
        _checkSplunkVersion: function(parentEl, requiredVersion) {
            var that = this;
            
            if (_.isUndefined(requiredVersion) || _.isNull(requiredVersion)) {
                return;
            }
            
            $(parentEl).append(' \
                <div class="page-section"> \
                    <table><tr> \
                        <td class="icon-container"> \
                            <div id="splunk-status" class="icon-container"> \
                            </div> \
                        </td> \
                        <td> \
                            <p class="title">Splunk v<span id="required-splunk-version"></span>+</p> \
                            <p id="old-splunk-version" hidden> \
                                <span class="invalid-content">Update required:</span> \
                                v<span id="current-splunk-version"></span> installed. \
                                Update to v<span id="required-splunk-version"></span> - \
                                <a href="http://www.splunk.com/download" target="_blank">Download Update.</a> \
                            </p> \
                            <p id="correct-splunk-version" hidden> \
                                <span class="valid-content">OK:</span> Splunk v<span id="current-splunk-version"></span> detected \
                                <p><span id="kvstore-result"> </span><span id="kvstore-status"></span> <a \
                                    href="/help?location=[MSExchange:1.4.3]app.splunk_app_windows_infrastructure.whatsnew.appkeyvaluestore" \
                                    target="_blank">Learn more.</a> \
                                </p> \
                            </p> \
                            <p id="error-splunk-version" class="invalid-content" hidden> \
                                Could not determine the Splunk version. Check if the feature is installed. \
                                <a href="http://www.splunk.com/download" target="_blank">Download here.</a> \
                            </p> \
                        </td> \
                    </tr></table> \
                </div> \
                ');
            
            this.prereqChecker._localSplunkd.serverInfo(function(error, serverInfo) {
                var versionToCheck = null;
                var versionToMatch = requiredVersion;
                
                var splunkProperties = serverInfo.properties();
                if (_.isUndefined(error) || _.isNull(error)) {
                    versionToCheck = splunkProperties.version || null;
                } else if (error.status === 404) {
                    $('#error-splunk-version').html(that._featureNotInstalledHtml);
                    $('#error-splunk-version a').prop(
                        'href',
                        'http://www.splunk.com/download'
                        );
                }
                
                var statusSel = '#splunk-status';
                
                if (that.prereqChecker._updateVersionInfo(
                    versionToCheck,
                    versionToMatch,
                    '#error-splunk-version',
                    '#old-splunk-version',
                    '#correct-splunk-version',
                    'span[id=required-splunk-version]',
                    'span[id=current-splunk-version]',
                    '#splunk-status'
                    )) {
                    if (splunkProperties.kvStoreStatus === 'ready') {  
                        $('#kvstore-status').text('Key value store is enabled.');
                        $('#kvstore-result').addClass('valid-content').text('OK: ');
                        that.prereqSatisfied = true;
                        
                        that.prereqChecker._pageStatusCallback(that.prereqChecker.arePrereqsSatisfied());
                    } else {
                        $('#kvstore-result').addClass('icon-x').text(' Key value store must be enabled.');
                        $('#kvstore-status').text(' Please enable it.');
                        $(statusSel).addClass('icon-x').removeClass('icon-check');
                    }
                }
            });
        },
        
        _checkTAWindowsVersion: function(parentEl, requiredVersion) {
            var that = this;
            
            if (_.isUndefined(requiredVersion) || _.isNull(requiredVersion)) {
                return;
            }
            $(parentEl).append(' \
                <div class="page-section"> \
                    <table><tr> \
                        <td class="icon-container"> \
                            <div id="TAWindows-status" class="icon-container"> \
                            </div> \
                        </td> \
                        <td> \
                            <p class="title">Splunk Add-on for Microsoft Windows v<span id="required-TAWindows-version"></span>+</p> \
                            <p id="old-TAWindows-version" hidden> \
                                <span class="invalid-content">Update required:</span> \
                                v<span id="current-TAWindows-version"></span> installed. \
                                Update to v<span id="required-TAWindows-version"></span> - \
                                <a href="http://apps.splunk.com/app/742/" target="_blank">Download Update.</a> \
                            </p> \
                            <p id="correct-TAWindows-version" hidden> \
                                <span class="valid-content">OK:</span> Splunk Add-on for Microsoft Windows v<span id="current-TAWindows-version"></span> detected \
                            </p> \
                            <p id="error-TAWindows-version" class="invalid-content" hidden> \
                                Could not determine the version for Splunk Add-on for Microsoft Windows. \
                                Check if the feature is installed. <a href="http://apps.splunk.com/app/742/" \
                                target="_blank">Download here.</a> \
                            </p> \
                        </td> \
                    </tr></table> \
                </div> \
                ');
            
            this.prereqChecker._localSplunkd.get(
                'apps/local/Splunk_TA_windows',
                null,
                function(error, appInfo) {
                    var versionToCheck = null;
                    var versionToMatch = requiredVersion;
                    
                    if (_.isUndefined(error) || _.isNull(error)) {
                        versionToCheck = appInfo.data.entry[0].content.version || null;
                    } else if (error.status === 404) {
                        $('#error-TAWindows-version').html(that.featureNotInstalled);
                        $('#error-TAWindows-version a').prop(
                            'href',
                            'http://apps.splunk.com/app/742/'
                            );
                    }
                    
                    that.prereqSatisfied = that.prereqChecker._updateVersionInfo(
                        versionToCheck,
                        versionToMatch,
                        '#error-TAWindows-version',
                        '#old-TAWindows-version',
                        '#correct-TAWindows-version',
                        'span[id=required-TAWindows-version]',
                        'span[id=current-TAWindows-version]',
                        '#TAWindows-status'
                        );
                    

                    that.prereqChecker._pageStatusCallback(that.prereqChecker.arePrereqsSatisfied());
                });
        },
        
        _checkSALdapSearchVersion: function(parentEl, requiredVersion) {
            var that = this;
            
            if (_.isUndefined(requiredVersion) || _.isNull(requiredVersion)) {
                return;
            }
            
            $(parentEl).append(' \
                <div class="page-section"> \
                    <table><tr> \
                        <td class="icon-container"> \
                            <div id="SALdap-status" class="icon-container"> \
                            </div> \
                        </td> \
                        <td> \
                            <p class="title">Splunk Supporting Add-on for Microsoft Windows Active Directory v<span id="required-SALdap-version"></span>+</p> \
                            <p id="old-SALdap-version" hidden> \
                                <span class="invalid-content">Update required:</span> \
                                v<span id="current-SALdap-version"></span> installed.  \
                                Update to v<span id="required-SALdap-version"></span> - \
                                <a href="http://apps.splunk.com/app/1151/" target="_blank">Download Update.</a> \
                            </p> \
                            <p id="correct-SALdap-version" hidden> \
                                <span class="valid-content">OK: </span> Splunk Supporting Add-on for Microsoft Windows Active Directory v<span id="current-SALdap-version"></span> detected \
                                <p id="SALdap-config-required" class="icon-x" hidden> Must be enabled and configured: <a  \
                                    href="/app/SA-ldapsearch/configuration?earliest=0&latest=" target="_blank">Enable and configure</a> \
                                </p> \
                            </p> \
                            <p id="error-SALdap-version" class="invalid-content" hidden> \
                                Could not determine the version for Splunk Supporting Add-on for Microsoft Windows Active Directory. \
                                Check if the feature is installed. <a href="http://apps.splunk.com/app/1151/" \
                                target="_blank">Download here.</a> \
                            </p> \
                        </td> \
                    </tr></table> \
                </div> \
            </div> \
            ');
            
            this.prereqChecker._localSplunkd.get(
                'apps/local/SA-ldapsearch',
                null,
                function(error, appInfo) {
                    var versionToCheck = null;
                    var versionToMatch = requiredVersion;
                    
                    if (_.isUndefined(error) || _.isNull(error)) {
                        versionToCheck = appInfo.data.entry[0].content.version || null;
                    } else if (error.status === 404) {
                        $('#error-SALdap-version').html(that.featureNotInstalled);
                        $('#error-SALdap-version a').prop(
                            'href',
                            'http://apps.splunk.com/app/1151/'
                            );
                    }
                    
                    var statusSel = '#SALdap-status';
                    
                    if (that.prereqChecker._updateVersionInfo(
                        versionToCheck,
                        versionToMatch,
                        '#error-SALdap-version',
                        '#old-SALdap-version',
                        '#correct-SALdap-version',
                        'span[id=required-SALdap-version]',
                        'span[id=current-SALdap-version]',
                        statusSel
                        )) {
                        SetupHelpers.isSaLdapSearchConfigured(function(isConfigured) {
                            if (isConfigured) {  
                                $('#SALdap-config-required').hide();
                                that.prereqSatisfied = true;
                                
                                that.prereqChecker._pageStatusCallback(that.prereqChecker.arePrereqsSatisfied());
                            } else {
                                $('#SALdap-config-required').show();
                                $(statusSel).addClass('icon-x').removeClass('icon-check');
                            }
                        });
                    }
                });
        },
        
        _checkRequiredUserRole: function(parentEl, requiredUserRole) {
            var that = this;
            
            if (_.isUndefined(requiredUserRole) || _.isNull(requiredUserRole)) {
                return;
            }
            
            $(parentEl).append(' \
                <div class="page-section"> \
                    <table><tr> \
                        <td class="icon-container"> \
                            <div id="user-roles" class="icon-container"> \
                            </div> \
                        </td> \
                        <td> \
                            <p class="title">Users and/or groups configured with the ' +
                                requiredUserRole + ' user role:</p> \
                            <div> \
                                <p id="no-users-with-role" class="invalid-content" hidden> \
                                    No users or groups with ' + requiredUserRole + ' user role detected. \
                                </p> \
                                <div> \
                                    <ul id="users-with-role" hidden></ul> \
                                </div> \
                                <p id="error-user-roles" class="invalid-content" hidden> \
                                    Could not determine if users and/or groups are configured with the ' +
                                    + requiredUserRole + ' user role. Try again later. \
                                </p> \
                            </div> \
                            <div> \
                                <p>Assign the <span id="required-role"></span> user role via Splunk Settings >> \
                                <a href="/manager/' + this.prereqChecker._appName + '/authentication/users" target="_blank">Access Controls</a> \
                                </p> \
                            </div> \
                        </td> \
                    </tr></table> \
                </div> \
                ');
            
            var usersCollection = this.prereqChecker._localSplunkd.users();

            usersCollection.fetch({}, function(error, users) {
                    var listOfUsers = users.list();
                    
                    var rolesInApp = null;
                    
                    if (_.isUndefined(error) || _.isNull(error)) {
                        that.prereqChecker._localSplunkd.get(
                            'authorization/roles',
                            null,
                            function(error, roles) {
                                if (_.isUndefined(error) || _.isNull(error)) {
                                    rolesInApp = roles.data.entry;
                                }
                                
                                var usersWithRequiredUserRole = _.filter(listOfUsers, function(user) {
                                    return !_.isUndefined(
                                        _.find(user.properties().roles, function(role) {
                                            if (role === requiredUserRole) {
                                                return true;
                                            } else {
                                                // Find if roles assigned to user indirectly includes
                                                // the required role
                                                
                                                return !(_.isUndefined(
                                                    _.find(rolesInApp, function(roleInApp) {
                                                        return (role === roleInApp.name &&
                                                            _.contains(
                                                                roleInApp.content.imported_roles,
                                                                requiredUserRole
                                                                ));
                                                    })
                                                    ));
                                            }
                                        })
                                        );
                                });
                                
                                if (usersWithRequiredUserRole.length > 0) {
                                    $('#user-roles').addClass('icon-check').removeClass('icon-x')
                                    
                                    $('#users-with-role').show();
                                    
                                    _.each(usersWithRequiredUserRole, function(user) {
                                        $('#users-with-role').append('<li>' + user.name + '</li>');
                                    });
                                    
                                    that.prereqSatisfied = true;
                                    that.prereqChecker._pageStatusCallback(that.prereqChecker.arePrereqsSatisfied());
                                } else {
                                    $('#no-users-with-role').show();
                                    $('#user-roles').addClass('icon-x').removeClass('icon-check');
                                }
                            });
                    } else {
                        $('#user-roles').addClass('icon-x').removeClass('icon-check');
                        $('#error-user-roles').show();
                    }
                    
                    $('span[id="required-role"]').text(requiredUserRole);
                });
        },

        _updateVersionInfo: function(
            versionToCheck,
            versionToMatch,
            errorElSel,
            oldVerElSel,
            correctVerElSel,
            requiredVerElsSel,
            currentVerElsSel,
            statusSel
            ) {
            var setTextForAllElements = function(elementSelector, textToSet) {
                $(elementSelector).each(function(index) {
                    $(this).text(textToSet);
                });
            };
            
            setTextForAllElements(requiredVerElsSel, versionToMatch);
            
            var versionUpToDate = false;
            
            if (versionToCheck === null) {
                $(errorElSel).show();
                $(statusSel).addClass('icon-x').removeClass('icon-check');
            } else {
                setTextForAllElements(currentVerElsSel, versionToCheck);
                if (SetupHelpers.checkVersionMatch(versionToCheck, versionToMatch)) {
                    $(correctVerElSel).show();
                    $(statusSel).addClass('icon-check').removeClass('icon-x');
                    
                    versionUpToDate = true;
                } else {
                    $(oldVerElSel).show();
                    $(statusSel).addClass('icon-x').removeClass('icon-check');
                }
            }
            
            return versionUpToDate;
        },

        _prereqsPassed: function(){
            var prereqsSatisfied = _.size(this._appRequiredPrereqs) === 
                _.size(_.filter(this._prereqsMap, function(prereqStatus) {
                    return prereqStatus.prereqSatisfied;
                }));
            return prereqsSatisfied;
        },

        enableNextButton: function(){
            $('.next-button').removeClass('disabled')
        },

        disableNextButton: function(){
            $('.next-button').addClass('disabled');
        },

        _bypassClicked: function($checkbox){
            if ($checkbox.is(':checked')) {
                this.enableNextButton();
            } 
            else {
                if (!this._prereqsPassed()) {
                    this.disableNextButton();
                }
            }
        }
    };
    
    return CheckPrerequisites;
});
