define(['splunk_app_windows_infrastructure/WinfraConstants'],
        function(WinfraConstants) {
    var WinfraSetupConfig = {
        get: function() {
            return {
                'appInfo': {
                    'appName': WinfraConstants.getAppName(),
                    'appRestId': WinfraConstants.getAppRestId()
                },
                'configurableFeatures': [
                    this.getConfigurableFeatures()
                ],
                'lookupBuilders': [
                    this.getLookupBuilders()
                ],
                'lookupMigrators': [
                    this.getLookupMigrators()
                ]
            };
        },

        getConfigurableFeatures: function() {
            return [
                {
                    'sectionId': 'Windows',
                    'sectionName': 'Windows',
                    'description': 'Get data inputs, searches, reports, alerts, and dashboards for Windows management. Monitor, manage, and troubleshoot Windows operating systems from one place.',
                    'learnMoreHref': '/help?location=[MSApp:1.4.3]app.splunk_app_windows_infrastructure.about.windows',
                    'features': [
                        {
                            'name': 'Event Monitoring',
                            'description': 'Get reports on Events across multiple event channels (Security, System, Application, etc.) from one or more machines.',
                            'baseSearch': 'eventtype=wineventlog_windows'
                        },
                        {
                            'name': 'Performance Monitoring',
                            'description': 'Monitor CPU, memory, network and disk utilization across one or more machines.',
                            'baseSearch': 'eventtype=perfmon_windows'
                        },
                        {
                            'name': 'Applications and Updates',
                            'description': 'Monitor application installs, crashes, and Windows updates.',
                            'baseSearch': 'eventtype=Update_Successful'
                        },
                        {
                            'name': 'Network Monitoring',
                            'description': 'Monitor inbound and outbound network connections being made and received by machines in your Windows infrastructure.',
                            'baseSearch': 'eventtype=netmon_windows'
                        },
                        {
                            'name': 'Print Monitoring',
                            'description': 'Monitor document printing, driver installations and other printer related activities.',
                            'baseSearch': 'eventtype=printmon_windows'
                        },
                        {
                            'name': 'Host Monitoring',
                            'description': ' Monitor various attributes of hardware and software including OS information, Network adapters and Disk drives on one or more machines.',
                            'baseSearch': 'eventtype=hostmon_windows'
                        }
                    ]
                },
                {
                    'sectionId': 'AD',
                    'sectionName': 'Active Directory',
                    'description': ' Gain deep insight into your Active Directory deployment. Monitor the health of your Active Directory, assess and dispatch security threats, and much more.',
                    'learnMoreHref': '/help?location=[MSApp:1.4.3]app.splunk_app_windows_infrastructure.about.ad',
                    'features': [
                        {
                            'name': 'Domains',
                            'description': 'Track performance, find issues, and monitor health.',
                            'baseSearch': 'eventtype=msad-dc-health'
                        },
                        {
                            'name': 'Domain Controllers',
                            'description': 'Monitor domain controller and site status.',
                            'baseSearch': 'eventtype=perfmon-ntds'
                        },
                        {
                            'name': 'DNS',
                            'description': 'Monitor DNS status, view zone information, and track DNS performance.',
                            'baseSearch': 'eventtype=perfmon-dns'
                        },
                        {
                            'name': 'Users',
                            'description': 'Audit users, view record changes, view logon issues, and run reports.',
                            'baseSearch': 'eventtype=msad-user-changes'
                        },
                        {
                            'name': 'Computers',
                            'description': 'Audit computers, view changes, and run reports.',
                            'baseSearch': 'eventtype=msad-computer-changes'
                        },
                        {
                            'name': 'Groups',
                            'description': 'Audit groups, view changes, and run reports.',
                            'baseSearch': 'eventtype=msad-group-changes'
                        },
                        {
                            'name': 'Group Policy',
                            'description': 'Audit group policies, view changes, and run reports.',
                            'baseSearch': 'eventtype=ad-files OR eventtype=admon'
                        },
                        {
                            'name': 'Organizational Units',
                            'description': 'Audit organizational units and run reports.',
                            'baseSearch': 'eventtype=ad-files OR eventtype=admon'
                        }
                    ]
                }
            ];
        },
        
        getLookupBuilders: function() {
            return [
                'WinApp_Lookup_Build_Perfmon - Update - Server',
                'WinApp_Lookup_Build_Perfmon - Update - Detail',
                'WinApp_Lookup_Build_Event - Update - Server',
                'WinApp_Lookup_Build_Event - Update - Detail',
                'WinApp_Lookup_Build_Hostmon - Update - Server',
                'WinApp_Lookup_Build_Hostmon_Machine - Update - Detail',
                'WinApp_Lookup_Build_Hostmon_FS - Update - Detail',
                'WinApp_Lookup_Build_Hostmon_Process - Update - Detail',
                'WinApp_Lookup_Build_Hostmon_Services - Update - Detail',
                'WinApp_Lookup_Build_Netmon - Update - Server',
                'WinApp_Lookup_Build_Netmon - Update - Detail',
                'WinApp_Lookup_Build_Printmon - Update',
                'DomainSelector_Lookup',
                'HostToDomain_Lookup_Update',
                'tHostInfo_Lookup_Update',
                'tSessions_Lookup_Update',
                'SiteInfo_Lookup_Update',
                'ActiveDirectory: Update GPO Lookup',
                'ActiveDirectory: Update Group Lookup',
                'ActiveDirectory: Update User Lookup',
                'ActiveDirectory: Update Computer Lookup',
                ];
        },

        getLookupMigrators: function() {
            return [
                'DomainSelector_Lookup_Migrate',
                'HostToDomain_Lookup_Migrate',
                'tHostInfo_Lookup_Migrate',
                'tSessions_Lookup_Migrate',
                'SiteInfo_Lookup_Migrate',
                'WinApp_Lookup_Build_Event - Migrate - Detail',
                'WinApp_Lookup_Build_Event - Migrate - Server',
                'WinApp_Lookup_Build_Hostmon - Migrate - Server',
                'WinApp_Lookup_Build_Hostmon_FS - Migrate - Detail',
                'WinApp_Lookup_Build_Hostmon_Machine - Migrate - Detail',
                'WinApp_Lookup_Build_Hostmon_Process - Migrate - Detail',
                'WinApp_Lookup_Build_Hostmon_Services - Migrate - Detail',
                'WinApp_Lookup_Build_Netmon - Migrate - Detail',
                'WinApp_Lookup_Build_Netmon - Migrate - Server',
                'WinApp_Lookup_Build_Perfmon - Migrate - Detail',
                'WinApp_Lookup_Build_Perfmon - Migrate - Server',
                'WinApp_Lookup_Build_Printmon - Migrate'
            ];
        }
    }
    
    return WinfraSetupConfig;
});