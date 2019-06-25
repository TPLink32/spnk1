define(function(require, exports, module) {

    var _ = require('underscore');
    var SimpleSplunkView = require("splunkjs/mvc/simplesplunkview");
    require("css!./ldaprecordview.css");

    var LDAPRecordView = SimpleSplunkView.extend({

        className: "splunk-app-microsoft-ldaprecordview",

        output_mode: "json",

        createView: function() {
            return true;
        },

        formatData: function(data){
        	return data;
        },

        updateView: function(viz, data) {
            if (data.length === 0) {
                return;
            }
            // The LDAP Record is a single record, but the JSON response is always an array
            // so just take the first one.
            var ldapRecord = data[0];
            if (!('objectClass' in ldapRecord)) {
                return;
            }
            
            // We have a proper record, so let's reset the UI and get on to display
            this.$el.empty();
            
            var ocMap = {};
            // For each object class, convert the name to the AD name, and add on
            // any auxiliary classes
            var ocList;
            if (ldapRecord.objectClass instanceof Array) {
                ocList = ldapRecord.objectClass;
            } else {
                ocList = [ ldapRecord.objectClass ];
            }
            for (var i = 0 ; i < ocList.length ; i++) {
                if (ocList[i] in this.adLDAPClasses) {
                    var oc = this.adLDAPClasses[ocList[i]];
                    // Our AD Class is one
                    ocMap[oc] = 1;
                    // Add on any auxiliary classes
                    if ('classes' in this.adSchemaClasses[oc]) {
                        for (var j = 0 ; j < this.adSchemaClasses[oc].classes.length ; j++) {
                            ocMap[this.adSchemaClasses[oc].classes[j]] = 1;
                        }
                    }
                }
            }
            // Convert back to an array
            var ocArray = [];
            for (var p in ocMap) {
                ocArray.push(p);
            }
            var objectClasses = ocArray.sort(this.caseInsensitive);

            // Each objectclass has it's own display mechanics as a panel.  The panel is
            // constructed as a pair of DIVs, one on top of the other, with a switcher on
            // the side.  We do "top" first, which is every single LDAP record
            this.buildOC("Top", ldapRecord);
            for (var ocidx = 0 ; ocidx < objectClasses.length ; ocidx++) {
                if (objectClasses[ocidx] != "Top") 
                    this.buildOC(objectClasses[ocidx], ldapRecord);
            }
        },

        getData: function(){
            return this.resultsModel.data().results;
        },
       

        // Builds the Object Class
        buildOC: function(oc, ldapRecord) {
            // MAIN BLOCK
            var block = $('<div class="oc" id="'+oc+'"><h3 class="title">'+oc+'</h3><div class="content"></div></div>').appendTo(this.$el);
            var title = $('div#'+oc+' > h3.title');
            var content = $('div#'+oc+' > div.content');

            // Now populate the content.  There are three possibilities here:
            //  1) We have a distinct method of rendering the object class
            //  2) We know about the objectclass and it's attributes
            //  3) We don't know about the objectclass
            //
            // 1) We have a distinct method of rendering the object class
            //      None of these yet
            
            // 2) We know about the objectClass
            if (oc in this.adSchemaClasses) {
                this.buildKnownSchemaClass(oc, ldapRecord, content);
                return;
            }
            
            // 3) We don't know about the objectClass
            $('<p><b>Unknown Object Class - Add Knowledge to LDAPRecord</p>').appendTo(content);
            return;
        },
        
        buildKnownSchemaClass: function(oc, ldapRecord, container) {
            var attrs = this.adSchemaClasses[oc].attributes;
            
            for (var i = 0 ; i < attrs.length ; i++) {
                if (attrs[i] in this.adSchemaAttributes) {
                    var ldapAttr = this.adSchemaAttributes[attrs[i]];
                    if (ldapAttr in ldapRecord) {
                        var v = ldapRecord[ldapAttr];
                        if (ldapRecord[ldapAttr] instanceof Array) {
                            v = ldapRecord[ldapAttr].join('<br/>');
                        }
                        $('<div class="attr"><div class="attrname">' + attrs[i] + '</div><div class="attrval">' + v + '</div></div>')
                            .appendTo(container);
                    }
                }
            }
        },
        
        /**
         * Sort Method for Array.sort() to do a case insensitive sort
         */
        caseInsensitive: function(x,y) {
            var a = String(x).toLowerCase(); 
            var b = String(y).toLowerCase();
            
            if (a > b) return 1;  
            if (a < b) return -1; 
            return 0;
        },
        
        /**
         * Knowledge for the Active Directory Schema - Attributes
         * 
         * Each Attribute has an LDAP name and a Active Directory name.
         * 
         * See: http://msdn.microsoft.com/en-us/library/windows/desktop/ms675090%28v=vs.85%29.aspx
         * 
         * This content is generated by get-ad-attributes.pl and converts between
         * a CN and an LDAP-Attribute-Name.  
         */
        adSchemaAttributes: {
            'ACS-Aggregate-Token-Rate-Per-User':    'aCSAggregateTokenRatePerUser',
            'ACS-Allocable-RSVP-Bandwidth': 'aCSAllocableRSVPBandwidth',
            'ACS-Cache-Timeout':    'aCSCacheTimeout',
            'ACS-DSBM-DeadTime':    'aCSDSBMDeadTime',
            'ACS-DSBM-Priority':    'aCSDSBMPriority',
            'ACS-DSBM-Refresh': 'aCSDSBMRefresh',
            'ACS-Direction':    'aCSDirection',
            'ACS-Enable-ACS-Service':   'aCSEnableACSService',
            'ACS-Enable-RSVP-Accounting':   'aCSEnableRSVPAccounting',
            'ACS-Enable-RSVP-Message-Logging':  'aCSEnableRSVPMessageLogging',
            'ACS-Event-Log-Level':  'aCSEventLogLevel',
            'ACS-Identity-Name':    'aCSIdentityName',
            'ACS-Max-Aggregate-Peak-Rate-Per-User': 'aCSMaxAggregatePeakRatePerUser',
            'ACS-Max-Duration-Per-Flow':    'aCSMaxDurationPerFlow',
            'ACS-Max-No-Of-Account-Files':  'aCSMaxNoOfAccountFiles',
            'ACS-Max-No-Of-Log-Files':  'aCSMaxNoOfLogFiles',
            'ACS-Max-Peak-Bandwidth':   'aCSMaxPeakBandwidth',
            'ACS-Max-Peak-Bandwidth-Per-Flow':  'aCSMaxPeakBandwidthPerFlow',
            'ACS-Max-Size-Of-RSVP-Account-File':    'aCSMaxSizeOfRSVPAccountFile',
            'ACS-Max-Size-Of-RSVP-Log-File':    'aCSMaxSizeOfRSVPLogFile',
            'ACS-Max-Token-Bucket-Per-Flow':    'aCSMaxTokenBucketPerFlow',
            'ACS-Max-Token-Rate-Per-Flow':  'aCSMaxTokenRatePerFlow',
            'ACS-Maximum-SDU-Size': 'aCSMaximumSDUSize',
            'ACS-Minimum-Delay-Variation':  'aCSMinimumDelayVariation',
            'ACS-Minimum-Latency':  'aCSMinimumLatency',
            'ACS-Minimum-Policed-Size': 'aCSMinimumPolicedSize',
            'ACS-Non-Reserved-Max-SDU-Size':    'aCSNonReservedMaxSDUSize',
            'ACS-Non-Reserved-Min-Policed-Size':    'aCSNonReservedMinPolicedSize',
            'ACS-Non-Reserved-Peak-Rate':   'aCSNonReservedPeakRate',
            'ACS-Non-Reserved-Token-Size':  'aCSNonReservedTokenSize',
            'ACS-Non-Reserved-Tx-Limit':    'aCSNonReservedTxLimit',
            'ACS-Non-Reserved-Tx-Size': 'aCSNonReservedTxSize',
            'ACS-Permission-Bits':  'aCSPermissionBits',
            'ACS-Policy-Name':  'aCSPolicyName',
            'ACS-Priority': 'aCSPriority',
            'ACS-RSVP-Account-Files-Location':  'aCSRSVPAccountFilesLocation',
            'ACS-RSVP-Log-Files-Location':  'aCSRSVPLogFilesLocation',
            'ACS-Server-List':  'aCSServerList',
            'ACS-Service-Type': 'aCSServiceType',
            'ACS-Time-Of-Day':  'aCSTimeOfDay',
            'ACS-Total-No-Of-Flows':    'aCSTotalNoOfFlows',
            'ANR':  'aNR',
            'Account-Expires':  'accountExpires',
            'Account-Name-History': 'accountNameHistory',
            'Additional-Information':   'notes',
            'Additional-Trusted-Service-Names': 'additionalTrustedServiceNames',
            'Address':  'streetAddress',
            'Address-Book-Roots':   'addressBookRoots',
            'Address-Book-Roots2':  'addressBookRoots2',
            'Address-Entry-Display-Table':  'addressEntryDisplayTable',
            'Address-Entry-Display-Table-MSDOS':    'addressEntryDisplayTableMSDOS',
            'Address-Home': 'homePostalAddress',
            'Address-Syntax':   'addressSyntax',
            'Address-Type': 'addressType',
            'Admin-Context-Menu':   'adminContextMenu',
            'Admin-Count':  'adminCount',
            'Admin-Description':    'adminDescription',
            'Admin-Display-Name':   'adminDisplayName',
            'Admin-Multiselect-Property-Pages': 'adminMultiselectPropertyPages',
            'Admin-Property-Pages': 'adminPropertyPages',
            'Allowed-Attributes':   'allowedAttributes',
            'Allowed-Attributes-Effective': 'allowedAttributesEffective',
            'Allowed-Child-Classes':    'allowedChildClasses',
            'Allowed-Child-Classes-Effective':  'allowedChildClassesEffective',
            'Alt-Security-Identities':  'altSecurityIdentities',
            'App-Schema-Version':   'appSchemaVersion',
            'Application-Name': 'applicationName',
            'Applies-To':   'appliesTo',
            'Asset-Number': 'assetNumber',
            'Assistant':    'assistant',
            'Assoc-NT-Account': 'assocNTAccount',
            'Attribute-Display-Names':  'attributeDisplayNames',
            'Attribute-ID': 'attributeID',
            'Attribute-Security-GUID':  'attributeSecurityGUID',
            'Attribute-Syntax': 'attributeSyntax',
            'Attribute-Types':  'attributeTypes',
            'Auditing-Policy':  'auditingPolicy',
            'Authentication-Options':   'authenticationOptions',
            'Authority-Revocation-List':    'authorityRevocationList',
            'Auxiliary-Class':  'auxiliaryClass',
            'Bad-Password-Time':    'badPasswordTime',
            'Bad-Pwd-Count':    'badPwdCount',
            'Birth-Location':   'birthLocation',
            'Bridgehead-Server-List-BL':    'bridgeheadServerListBL',
            'Bridgehead-Transport-List':    'bridgeheadTransportList',
            'Builtin-Creation-Time':    'builtinCreationTime',
            'Builtin-Modified-Count':   'builtinModifiedCount',
            'Business-Category':    'businessCategory',
            'Bytes-Per-Minute': 'bytesPerMinute',
            'CA-Certificate':   'cACertificate',
            'CA-Certificate-DN':    'cACertificateDN',
            'CA-Connect':   'cAConnect',
            'CA-Usages':    'cAUsages',
            'CA-WEB-URL':   'cAWEBURL',
            'COM-CLSID':    'cOMCLSID',
            'COM-ClassID':  'cOMClassID',
            'COM-InterfaceID':  'cOMInterfaceID',
            'COM-Other-Prog-Id':    'cOMOtherProgId',
            'COM-ProgID':   'cOMProgID',
            'COM-Treat-As-Class-Id':    'cOMTreatAsClassId',
            'COM-Typelib-Id':   'cOMTypelibId',
            'COM-Unique-LIBID': 'cOMUniqueLIBID',
            'CRL-Object':   'cRLObject',
            'CRL-Partitioned-Revocation-List':  'cRLPartitionedRevocationList',
            'Can-Upgrade-Script':   'canUpgradeScript',
            'Canonical-Name':   'canonicalName',
            'Catalogs': 'catalogs',
            'Categories':   'categories',
            'Category-Id':  'categoryId',
            'Certificate-Authority-Object': 'certificateAuthorityObject',
            'Certificate-Revocation-List':  'certificateRevocationList',
            'Certificate-Templates':    'certificateTemplates',
            'Class-Display-Name':   'classDisplayName',
            'Code-Page':    'codePage',
            'Comment':  'info',
            'Common-Name':  'cn',
            'Company':  'company',
            'Content-Indexing-Allowed': 'contentIndexingAllowed',
            'Context-Menu': 'contextMenu',
            'Control-Access-Rights':    'controlAccessRights',
            'Cost': 'cost',
            'Country-Code': 'countryCode',
            'Country-Name': 'c',
            'Create-Dialog':    'createDialog',
            'Create-Time-Stamp':    'createTimeStamp',
            'Create-Wizard-Ext':    'createWizardExt',
            'Creation-Time':    'creationTime',
            'Creation-Wizard':  'creationWizard',
            'Creator':  'creator',
            'Cross-Certificate-Pair':   'crossCertificatePair',
            'Curr-Machine-Id':  'currMachineId',
            'Current-Location': 'currentLocation',
            'Current-Parent-CA':    'currentParentCA',
            'Current-Value':    'currentValue',
            'DBCS-Pwd': 'dBCSPwd',
            'DIT-Content-Rules':    'dITContentRules',
            'DMD-Location': 'dMDLocation',
            'DMD-Name': 'dmdName',
            'DN-Reference-Update':  'dNReferenceUpdate',
            'DNS-Host-Name':    'dNSHostName',
            'DNS-Property': 'dNSProperty',
            'DNS-Tombstoned':   'dNSTombstoned',
            'DS-Core-Propagation-Data': 'dSCorePropagationData',
            'DS-Heuristics':    'dSHeuristics',
            'DS-UI-Admin-Maximum':  'dSUIAdminMaximum',
            'DS-UI-Admin-Notification': 'dSUIAdminNotification',
            'DS-UI-Shell-Maximum':  'dSUIShellMaximum',
            'DSA-Signature':    'dSASignature',
            'Default-Class-Store':  'defaultClassStore',
            'Default-Group':    'defaultGroup',
            'Default-Hiding-Value': 'defaultHidingValue',
            'Default-Local-Policy-Object':  'defaultLocalPolicyObject',
            'Default-Object-Category':  'defaultObjectCategory',
            'Default-Priority': 'defaultPriority',
            'Default-Security-Descriptor':  'defaultSecurityDescriptor',
            'Delta-Revocation-List':    'deltaRevocationList',
            'Department':   'department',
            'Description':  'description',
            'Desktop-Profile':  'desktopProfile',
            'Destination-Indicator':    'destinationIndicator',
            'Display-Name': 'displayName',
            'Display-Name-Printable':   'displayNamePrintable',
            'Division': 'division',
            'Dns-Allow-Dynamic':    'dnsAllowDynamic',
            'Dns-Allow-XFR':    'dnsAllowXFR',
            'Dns-Notify-Secondaries':   'dnsNotifySecondaries',
            'Dns-Record':   'dnsRecord',
            'Dns-Root': 'dnsRoot',
            'Dns-Secure-Secondaries':   'dnsSecureSecondaries',
            'Domain-Certificate-Authorities':   'domainCAs',
            'Domain-Component': 'dc',
            'Domain-Cross-Ref': 'domainCrossRef',
            'Domain-ID':    'domainID',
            'Domain-Identifier':    'domainIdentifier',
            'Domain-Policy-Object': 'domainPolicyObject',
            'Domain-Policy-Reference':  'domainPolicyReference',
            'Domain-Replica':   'domainReplica',
            'Domain-Wide-Policy':   'domainWidePolicy',
            'Driver-Name':  'driverName',
            'Driver-Version':   'driverVersion',
            'Dynamic-LDAP-Server':  'dynamicLDAPServer',
            'E-mail-Addresses': 'mail',
            'EFSPolicy':    'eFSPolicy',
            'Employee-ID':  'employeeID',
            'Employee-Number':  'employeeNumber',
            'Employee-Type':    'employeeType',
            'Enabled':  'Enabled',
            'Enabled-Connection':   'enabledConnection',
            'Enrollment-Providers': 'enrollmentProviders',
            'Entry-TTL':    'entryTTL',
            'Extended-Attribute-Info':  'extendedAttributeInfo',
            'Extended-Chars-Allowed':   'extendedCharsAllowed',
            'Extended-Class-Info':  'extendedClassInfo',
            'Extension-Name':   'extensionName',
            'Extra-Columns':    'extraColumns',
            'FRS-Control-Data-Creation':    'fRSControlDataCreation',
            'FRS-Control-Inbound-Backlog':  'fRSControlInboundBacklog',
            'FRS-Control-Outbound-Backlog': 'fRSControlOutboundBacklog',
            'FRS-DS-Poll':  'fRSDSPoll',
            'FRS-Directory-Filter': 'fRSDirectoryFilter',
            'FRS-Extensions':   'fRSExtensions',
            'FRS-Fault-Condition':  'fRSFaultCondition',
            'FRS-File-Filter':  'fRSFileFilter',
            'FRS-Flags':    'fRSFlags',
            'FRS-Level-Limit':  'fRSLevelLimit',
            'FRS-Member-Reference': 'fRSMemberReference',
            'FRS-Member-Reference-BL':  'fRSMemberReferenceBL',
            'FRS-Partner-Auth-Level':   'fRSPartnerAuthLevel',
            'FRS-Primary-Member':   'fRSPrimaryMember',
            'FRS-Replica-Set-GUID': 'fRSReplicaSetGUID',
            'FRS-Replica-Set-Type': 'fRSReplicaSetType',
            'FRS-Root-Path':    'fRSRootPath',
            'FRS-Root-Security':    'fRSRootSecurity',
            'FRS-Service-Command':  'fRSServiceCommand',
            'FRS-Service-Command-Status':   'fRSServiceCommandStatus',
            'FRS-Staging-Path': 'fRSStagingPath',
            'FRS-Time-Last-Command':    'fRSTimeLastCommand',
            'FRS-Time-Last-Config-Change':  'fRSTimeLastConfigChange',
            'FRS-Update-Timeout':   'fRSUpdateTimeout',
            'FRS-Version':  'fRSVersion',
            'FRS-Version-GUID': 'fRSVersionGUID',
            'FRS-Working-Path': 'fRSWorkingPath',
            'FSMO-Role-Owner':  'fSMORoleOwner',
            'Facsimile-Telephone-Number':   'facsimileTelephoneNumber',
            'File-Ext-Priority':    'fileExtPriority',
            'Flags':    'flags',
            'Flat-Name':    'flatName',
            'Force-Logoff': 'forceLogoff',
            'Foreign-Identifier':   'foreignIdentifier',
            'Friendly-Names':   'friendlyNames',
            'From-Entry':   'fromEntry',
            'From-Server':  'fromServer',
            'Frs-Computer-Reference':   'frsComputerReference',
            'Frs-Computer-Reference-BL':    'frsComputerReferenceBL',
            'GP-Link':  'gPLink',
            'GP-Options':   'gPOptions',
            'GPC-File-Sys-Path':    'gPCFileSysPath',
            'GPC-Functionality-Version':    'gPCFunctionalityVersion',
            'GPC-Machine-Extension-Names':  'gPCMachineExtensionNames',
            'GPC-User-Extension-Names': 'gPCUserExtensionNames',
            'GPC-WQL-Filter':   'gPCWQLFilter',
            'Garbage-Coll-Period':  'garbageCollPeriod',
            'Generated-Connection': 'generatedConnection',
            'Generation-Qualifier': 'generationQualifier',
            'Given-Name':   'givenName',
            'Global-Address-List':  'globalAddressList',
            'Global-Address-List2': 'globalAddressList2',
            'Governs-ID':   'governsID',
            'Group-Attributes': 'groupAttributes',
            'Group-Membership-SAM': 'groupMembershipSAM',
            'Group-Priority':   'groupPriority',
            'Group-Type':   'groupType',
            'Groups-to-Ignore': 'groupsToIgnore',
            'Has-Master-NCs':   'hasMasterNCs',
            'Has-Partial-Replica-NCs':  'hasPartialReplicaNCs',
            'Help-Data16':  'helpData16',
            'Help-Data32':  'helpData32',
            'Help-File-Name':   'helpFileName',
            'Hide-From-AB': 'hideFromAB',
            'Home-Directory':   'homeDirectory',
            'Home-Drive':   'homeDrive',
            'IPSEC-Negotiation-Policy-Action':  'iPSECNegotiationPolicyAction',
            'IPSEC-Negotiation-Policy-Type':    'iPSECNegotiationPolicyType',
            'Icon-Path':    'iconPath',
            'Implemented-Categories':   'implementedCategories',
            'IndexedScopes':    'indexedScopes',
            'Initial-Auth-Incoming':    'initialAuthIncoming',
            'Initial-Auth-Outgoing':    'initialAuthOutgoing',
            'Initials': 'initials',
            'Install-Ui-Level': 'installUiLevel',
            'Instance-Type':    'instanceType',
            'Inter-Site-Topology-Failover': 'interSiteTopologyFailover',
            'Inter-Site-Topology-Generator':    'interSiteTopologyGenerator',
            'Inter-Site-Topology-Renew':    'interSiteTopologyRenew',
            'International-ISDN-Number':    'internationalISDNNumber',
            'Invocation-Id':    'invocationId',
            'Ipsec-Data':   'ipsecData',
            'Ipsec-Data-Type':  'ipsecDataType',
            'Ipsec-Filter-Reference':   'ipsecFilterReference',
            'Ipsec-ID': 'ipsecID',
            'Ipsec-ISAKMP-Reference':   'ipsecISAKMPReference',
            'Ipsec-NFA-Reference':  'ipsecNFAReference',
            'Ipsec-Name':   'ipsecName',
            'Ipsec-Negotiation-Policy-Reference':   'ipsecNegotiationPolicyReference',
            'Ipsec-Owners-Reference':   'ipsecOwnersReference',
            'Ipsec-Policy-Reference':   'ipsecPolicyReference',
            'Is-Critical-System-Object':    'isCriticalSystemObject',
            'Is-Defunct':   'isDefunct',
            'Is-Deleted':   'isDeleted',
            'Is-Ephemeral': 'isEphemeral',
            'Is-Member-Of-DL':  'memberOf',
            'Is-Member-Of-Partial-Attribute-Set':   'isMemberOfPartialAttributeSet',
            'Is-Privilege-Holder':  'isPrivilegeHolder',
            'Is-Recycled':  'isRecycled',
            'Is-Single-Valued': 'isSingleValued',
            'Keywords': 'keywords',
            'Knowledge-Information':    'knowledgeInformation',
            'LDAP-Admin-Limits':    'lDAPAdminLimits',
            'LDAP-Display-Name':    'lDAPDisplayName',
            'LDAP-IPDeny-List': 'lDAPIPDenyList',
            'LSA-Creation-Time':    'lSACreationTime',
            'LSA-Modified-Count':   'lSAModifiedCount',
            'Last-Backup-Restoration-Time': 'lastBackupRestorationTime',
            'Last-Content-Indexed': 'lastContentIndexed',
            'Last-Known-Parent':    'lastKnownParent',
            'Last-Logoff':  'lastLogoff',
            'Last-Logon':   'lastLogon',
            'Last-Logon-Timestamp': 'lastLogonTimestamp',
            'Last-Set-Time':    'lastSetTime',
            'Last-Update-Sequence': 'lastUpdateSequence',
            'Legacy-Exchange-DN':   'legacyExchangeDN',
            'Link-ID':  'linkID',
            'Link-Track-Secret':    'linkTrackSecret',
            'Lm-Pwd-History':   'lmPwdHistory',
            'Local-Policy-Flags':   'localPolicyFlags',
            'Local-Policy-Reference':   'localPolicyReference',
            'Locale-ID':    'localeID',
            'Locality-Name':    'l',
            'Localization-Display-Id':  'localizationDisplayId',
            'Localized-Description':    'localizedDescription',
            'Location': 'location',
            'Lock-Out-Observation-Window':  'lockOutObservationWindow',
            'Lockout-Duration': 'lockoutDuration',
            'Lockout-Threshold':    'lockoutThreshold',
            'Lockout-Time': 'lockoutTime',
            'Logo': 'thumbnailLogo',
            'Logon-Count':  'logonCount',
            'Logon-Hours':  'logonHours',
            'Logon-Workstation':    'logonWorkstation',
            'MAPI-ID':  'mAPIID',
            'MHS-OR-Address':   'mhsORAddress',
            'MS-DRM-Identity-Certificate':  'msDRM-IdentityCertificate',
            'MS-DS-All-Users-Trust-Quota':  'msDS-AllUsersTrustQuota',
            'MS-DS-Consistency-Child-Count':    'mS-DS-ConsistencyChildCount',
            'MS-DS-Consistency-Guid':   'mS-DS-ConsistencyGuid',
            'MS-DS-Creator-SID':    'mS-DS-CreatorSID',
            'MS-DS-Machine-Account-Quota':  'ms-DS-MachineAccountQuota',
            'MS-DS-Per-User-Trust-Quota':   'msDS-PerUserTrustQuota',
            'MS-DS-Per-User-Trust-Tombstones-Quota':    'msDS-PerUserTrustTombstonesQuota',
            'MS-DS-Replicates-NC-Reason':   'mS-DS-ReplicatesNCReason',
            'MS-SQL-Alias': 'mS-SQL-Alias',
            'MS-SQL-AllowAnonymousSubscription':    'mS-SQL-AllowAnonymousSubscription',
            'MS-SQL-AllowImmediateUpdatingSubscription':    'mS-SQL-AllowImmediateUpdatingSubscription',
            'MS-SQL-AllowKnownPullSubscription':    'mS-SQL-AllowKnownPullSubscription',
            'MS-SQL-AllowQueuedUpdatingSubscription':   'mS-SQL-AllowQueuedUpdatingSubscription',
            'MS-SQL-AllowSnapshotFilesFTPDownloading':  'mS-SQL-AllowSnapshotFilesFTPDownloading',
            'MS-SQL-AppleTalk': 'mS-SQL-AppleTalk',
            'MS-SQL-Applications':  'mS-SQL-Applications',
            'MS-SQL-Build': 'mS-SQL-Build',
            'MS-SQL-CharacterSet':  'mS-SQL-CharacterSet',
            'MS-SQL-Clustered': 'mS-SQL-Clustered',
            'MS-SQL-ConnectionURL': 'mS-SQL-ConnectionURL',
            'MS-SQL-Contact':   'mS-SQL-Contact',
            'MS-SQL-CreationDate':  'mS-SQL-CreationDate',
            'MS-SQL-Database':  'mS-SQL-Database',
            'MS-SQL-Description':   'mS-SQL-Description',
            'MS-SQL-GPSHeight': 'mS-SQL-GPSHeight',
            'MS-SQL-GPSLatitude':   'mS-SQL-GPSLatitude',
            'MS-SQL-GPSLongitude':  'mS-SQL-GPSLongitude',
            'MS-SQL-InformationDirectory':  'mS-SQL-InformationDirectory',
            'MS-SQL-InformationURL':    'mS-SQL-InformationURL',
            'MS-SQL-Keywords':  'mS-SQL-Keywords',
            'MS-SQL-Language':  'mS-SQL-Language',
            'MS-SQL-LastBackupDate':    'mS-SQL-LastBackupDate',
            'MS-SQL-LastDiagnosticDate':    'mS-SQL-LastDiagnosticDate',
            'MS-SQL-LastUpdatedDate':   'mS-SQL-LastUpdatedDate',
            'MS-SQL-Location':  'mS-SQL-Location',
            'MS-SQL-Memory':    'mS-SQL-Memory',
            'MS-SQL-MultiProtocol': 'mS-SQL-MultiProtocol',
            'MS-SQL-Name':  'mS-SQL-Name',
            'MS-SQL-NamedPipe': 'mS-SQL-NamedPipe',
            'MS-SQL-PublicationURL':    'mS-SQL-PublicationURL',
            'MS-SQL-Publisher': 'mS-SQL-Publisher',
            'MS-SQL-RegisteredOwner':   'mS-SQL-RegisteredOwner',
            'MS-SQL-SPX':   'mS-SQL-SPX',
            'MS-SQL-ServiceAccount':    'mS-SQL-ServiceAccount',
            'MS-SQL-Size':  'mS-SQL-Size',
            'MS-SQL-SortOrder': 'mS-SQL-SortOrder',
            'MS-SQL-Status':    'mS-SQL-Status',
            'MS-SQL-TCPIP': 'mS-SQL-TCPIP',
            'MS-SQL-ThirdParty':    'mS-SQL-ThirdParty',
            'MS-SQL-Type':  'mS-SQL-Type',
            'MS-SQL-UnicodeSortOrder':  'mS-SQL-UnicodeSortOrder',
            'MS-SQL-Version':   'mS-SQL-Version',
            'MS-SQL-Vines': 'mS-SQL-Vines',
            'MS-TS-ExpireDate': 'msTSExpireDate',
            'MS-TS-ExpireDate2':    'msTSExpireDate2',
            'MS-TS-ExpireDate3':    'msTSExpireDate3',
            'MS-TS-ExpireDate4':    'msTSExpireDate4',
            'MS-TS-LicenseVersion': 'msTSLicenseVersion',
            'MS-TS-LicenseVersion2':    'msTSLicenseVersion2',
            'MS-TS-LicenseVersion3':    'msTSLicenseVersion3',
            'MS-TS-LicenseVersion4':    'msTSLicenseVersion4',
            'MS-TS-ManagingLS': 'msTSManagingLS',
            'MS-TS-ManagingLS2':    'msTSManagingLS2',
            'MS-TS-ManagingLS3':    'msTSManagingLS3',
            'MS-TS-ManagingLS4':    'msTSManagingLS4',
            'MS-TS-Property01': 'msTSProperty01',
            'MS-TS-Property02': 'msTSProperty02',
            'MS-TSLS-Property01':   'msTSLSProperty01',
            'MS-TSLS-Property02':   'msTSLSProperty02',
            'MSMQ-Authenticate':    'mSMQAuthenticate',
            'MSMQ-Base-Priority':   'mSMQBasePriority',
            'MSMQ-CSP-Name':    'mSMQCSPName',
            'MSMQ-Computer-Type':   'mSMQComputerType',
            'MSMQ-Computer-Type-Ex':    'mSMQComputerTypeEx',
            'MSMQ-Cost':    'mSMQCost',
            'MSMQ-Dependent-Client-Service':    'mSMQDependentClientService',
            'MSMQ-Dependent-Client-Services':   'mSMQDependentClientServices',
            'MSMQ-Digests': 'mSMQDigests',
            'MSMQ-Digests-Mig': 'mSMQDigestsMig',
            'MSMQ-Ds-Service':  'mSMQDsService',
            'MSMQ-Ds-Services': 'mSMQDsServices',
            'MSMQ-Encrypt-Key': 'mSMQEncryptKey',
            'MSMQ-Foreign': 'mSMQForeign',
            'MSMQ-In-Routing-Servers':  'mSMQInRoutingServers',
            'MSMQ-Interval1':   'mSMQInterval1',
            'MSMQ-Interval2':   'mSMQInterval2',
            'MSMQ-Journal': 'mSMQJournal',
            'MSMQ-Journal-Quota':   'mSMQJournalQuota',
            'MSMQ-Label':   'mSMQLabel',
            'MSMQ-Label-Ex':    'mSMQLabelEx',
            'MSMQ-Long-Lived':  'mSMQLongLived',
            'MSMQ-Migrated':    'mSMQMigrated',
            'MSMQ-Multicast-Address':   'MSMQ-MulticastAddress',
            'MSMQ-Name-Style':  'mSMQNameStyle',
            'MSMQ-Nt4-Flags':   'mSMQNt4Flags',
            'MSMQ-Nt4-Stub':    'mSMQNt4Stub',
            'MSMQ-OS-Type': 'mSMQOSType',
            'MSMQ-Out-Routing-Servers': 'mSMQOutRoutingServers',
            'MSMQ-Owner-ID':    'mSMQOwnerID',
            'MSMQ-Prev-Site-Gates': 'mSMQPrevSiteGates',
            'MSMQ-Privacy-Level':   'mSMQPrivacyLevel',
            'MSMQ-QM-ID':   'mSMQQMID',
            'MSMQ-Queue-Journal-Quota': 'mSMQQueueJournalQuota',
            'MSMQ-Queue-Name-Ext':  'mSMQQueueNameExt',
            'MSMQ-Queue-Quota': 'mSMQQueueQuota',
            'MSMQ-Queue-Type':  'mSMQQueueType',
            'MSMQ-Quota':   'mSMQQuota',
            'MSMQ-Recipient-FormatName':    'msMQ-Recipient-FormatName',
            'MSMQ-Routing-Service': 'mSMQRoutingService',
            'MSMQ-Routing-Services':    'mSMQRoutingServices',
            'MSMQ-Secured-Source':  'MSMQ-SecuredSource',
            'MSMQ-Service-Type':    'mSMQServiceType',
            'MSMQ-Services':    'mSMQServices',
            'MSMQ-Sign-Certificates':   'mSMQSignCertificates',
            'MSMQ-Sign-Certificates-Mig':   'mSMQSignCertificatesMig',
            'MSMQ-Sign-Key':    'mSMQSignKey',
            'MSMQ-Site-1':  'mSMQSite1',
            'MSMQ-Site-2':  'mSMQSite2',
            'MSMQ-Site-Foreign':    'mSMQSiteForeign',
            'MSMQ-Site-Gates':  'mSMQSiteGates',
            'MSMQ-Site-Gates-Mig':  'mSMQSiteGatesMig',
            'MSMQ-Site-ID': 'mSMQSiteID',
            'MSMQ-Site-Name':   'mSMQSiteName',
            'MSMQ-Site-Name-Ex':    'mSMQSiteNameEx',
            'MSMQ-Sites':   'mSMQSites',
            'MSMQ-Transactional':   'mSMQTransactional',
            'MSMQ-User-Sid':    'mSMQUserSid',
            'MSMQ-Version': 'mSMQVersion',
            'Machine-Architecture': 'machineArchitecture',
            'Machine-Password-Change-Interval': 'machinePasswordChangeInterval',
            'Machine-Role': 'machineRole',
            'Machine-Wide-Policy':  'machineWidePolicy',
            'Managed-By':   'managedBy',
            'Managed-Objects':  'managedObjects',
            'Manager':  'manager',
            'Marshalled-Interface': 'marshalledInterface',
            'Mastered-By':  'masteredBy',
            'Max-Pwd-Age':  'maxPwdAge',
            'Max-Renew-Age':    'maxRenewAge',
            'Max-Storage':  'maxStorage',
            'Max-Ticket-Age':   'maxTicketAge',
            'May-Contain':  'mayContain',
            'Member':   'member',
            'Min-Pwd-Age':  'minPwdAge',
            'Min-Pwd-Length':   'minPwdLength',
            'Min-Ticket-Age':   'minTicketAge',
            'Modified-Count':   'modifiedCount',
            'Modified-Count-At-Last-Prom':  'modifiedCountAtLastProm',
            'Modify-Time-Stamp':    'modifyTimeStamp',
            'Moniker':  'moniker',
            'Moniker-Display-Name': 'monikerDisplayName',
            'Move-Tree-State':  'moveTreeState',
            'Mscope-Id':    'mscopeId',
            'Msi-File-List':    'msiFileList',
            'Msi-Script':   'msiScript',
            'Msi-Script-Name':  'msiScriptName',
            'Msi-Script-Path':  'msiScriptPath',
            'Msi-Script-Size':  'msiScriptSize',
            'Must-Contain': 'mustContain',
            'NC-Name':  'nCName',
            'NETBIOS-Name': 'nETBIOSName',
            'NT-Group-Members': 'nTGroupMembers',
            'NT-Mixed-Domain':  'nTMixedDomain',
            'NT-Security-Descriptor':   'nTSecurityDescriptor',
            'Name-Service-Flags':   'nameServiceFlags',
            'Netboot-GUID': 'netbootGUID',
            'Netboot-Initialization':   'netbootInitialization',
            'Netboot-Machine-File-Path':    'netbootMachineFilePath',
            'Netboot-Mirror-Data-File': 'netbootMirrorDataFile',
            'Netboot-SIF-File': 'netbootSIFFile',
            'Network-Address':  'networkAddress',
            'Next-Level-Store': 'nextLevelStore',
            'Next-Rid': 'nextRid',
            'Non-Security-Member':  'nonSecurityMember',
            'Non-Security-Member-BL':   'nonSecurityMemberBL',
            'Notification-List':    'notificationList',
            'Nt-Pwd-History':   'ntPwdHistory',
            'OEM-Information':  'oEMInformation',
            'OM-Object-Class':  'oMObjectClass',
            'OM-Syntax':    'oMSyntax',
            'OMT-Guid': 'oMTGuid',
            'OMT-Indx-Guid':    'oMTIndxGuid',
            'Obj-Dist-Name':    'distinguishedName',
            'Object-Category':  'objectCategory',
            'Object-Class': 'objectClass',
            'Object-Class-Category':    'objectClassCategory',
            'Object-Classes':   'objectClasses',
            'Object-Count': 'objectCount',
            'Object-Guid':  'objectGUID',
            'Object-Sid':   'objectSid',
            'Object-Version':   'objectVersion',
            'Operating-System': 'operatingSystem',
            'Operating-System-Hotfix':  'operatingSystemHotfix',
            'Operating-System-Service-Pack':    'operatingSystemServicePack',
            'Operating-System-Version': 'operatingSystemVersion',
            'Operator-Count':   'operatorCount',
            'Option-Description':   'optionDescription',
            'Options':  'options',
            'Options-Location': 'optionsLocation',
            'Organization-Name':    'o',
            'Organizational-Unit-Name': 'ou',
            'Original-Display-Table':   'originalDisplayTable',
            'Original-Display-Table-MSDOS': 'originalDisplayTableMSDOS',
            'Other-Login-Workstations': 'otherLoginWorkstations',
            'Other-Mailbox':    'otherMailbox',
            'Other-Name':   'middleName',
            'Other-Well-Known-Objects': 'otherWellKnownObjects',
            'Owner':    'owner',
            'PKI-Critical-Extensions':  'pKICriticalExtensions',
            'PKI-Default-CSPs': 'pKIDefaultCSPs',
            'PKI-Default-Key-Spec': 'pKIDefaultKeySpec',
            'PKI-Enrollment-Access':    'pKIEnrollmentAccess',
            'PKI-Expiration-Period':    'pKIExpirationPeriod',
            'PKI-Extended-Key-Usage':   'pKIExtendedKeyUsage',
            'PKI-Key-Usage':    'pKIKeyUsage',
            'PKI-Max-Issuing-Depth':    'pKIMaxIssuingDepth',
            'PKI-Overlap-Period':   'pKIOverlapPeriod',
            'PKT':  'pKT',
            'PKT-Guid': 'pKTGuid',
            'Package-Flags':    'packageFlags',
            'Package-Name': 'packageName',
            'Package-Type': 'packageType',
            'Parent-CA':    'parentCA',
            'Parent-CA-Certificate-Chain':  'parentCACertificateChain',
            'Parent-GUID':  'parentGUID',
            'Partial-Attribute-Deletion-List':  'partialAttributeDeletionList',
            'Partial-Attribute-Set':    'partialAttributeSet',
            'Pek-Key-Change-Interval':  'pekKeyChangeInterval',
            'Pek-List': 'pekList',
            'Pending-CA-Certificates':  'pendingCACertificates',
            'Pending-Parent-CA':    'pendingParentCA',
            'Per-Msg-Dialog-Display-Table': 'perMsgDialogDisplayTable',
            'Per-Recip-Dialog-Display-Table':   'perRecipDialogDisplayTable',
            'Personal-Title':   'personalTitle',
            'Phone-Fax-Other':  'otherFacsimileTelephoneNumber',
            'Phone-Home-Other': 'otherHomePhone',
            'Phone-Home-Primary':   'homePhone',
            'Phone-ISDN-Primary':   'primaryInternationalISDNNumber',
            'Phone-Ip-Other':   'otherIpPhone',
            'Phone-Ip-Primary': 'ipPhone',
            'Phone-Mobile-Other':   'otherMobile',
            'Phone-Mobile-Primary': 'mobile',
            'Phone-Office-Other':   'otherTelephone',
            'Phone-Pager-Other':    'otherPager',
            'Phone-Pager-Primary':  'pager',
            'Physical-Delivery-Office-Name':    'physicalDeliveryOfficeName',
            'Physical-Location-Object': 'physicalLocationObject',
            'Picture':  'thumbnailPhoto',
            'Policy-Replication-Flags': 'policyReplicationFlags',
            'Port-Name':    'portName',
            'Poss-Superiors':   'possSuperiors',
            'Possible-Inferiors':   'possibleInferiors',
            'Post-Office-Box':  'postOfficeBox',
            'Postal-Address':   'postalAddress',
            'Postal-Code':  'postalCode',
            'Preferred-Delivery-Method':    'preferredDeliveryMethod',
            'Preferred-OU': 'preferredOU',
            'Prefix-Map':   'prefixMap',
            'Presentation-Address': 'presentationAddress',
            'Previous-CA-Certificates': 'previousCACertificates',
            'Previous-Parent-CA':   'previousParentCA',
            'Primary-Group-ID': 'primaryGroupID',
            'Primary-Group-Token':  'primaryGroupToken',
            'Print-Attributes': 'printAttributes',
            'Print-Bin-Names':  'printBinNames',
            'Print-Collate':    'printCollate',
            'Print-Color':  'printColor',
            'Print-Duplex-Supported':   'printDuplexSupported',
            'Print-End-Time':   'printEndTime',
            'Print-Form-Name':  'printFormName',
            'Print-Keep-Printed-Jobs':  'printKeepPrintedJobs',
            'Print-Language':   'printLanguage',
            'Print-MAC-Address':    'printMACAddress',
            'Print-Max-Copies': 'printMaxCopies',
            'Print-Max-Resolution-Supported':   'printMaxResolutionSupported',
            'Print-Max-X-Extent':   'printMaxXExtent',
            'Print-Max-Y-Extent':   'printMaxYExtent',
            'Print-Media-Ready':    'printMediaReady',
            'Print-Media-Supported':    'printMediaSupported',
            'Print-Memory': 'printMemory',
            'Print-Min-X-Extent':   'printMinXExtent',
            'Print-Min-Y-Extent':   'printMinYExtent',
            'Print-Network-Address':    'printNetworkAddress',
            'Print-Notify': 'printNotify',
            'Print-Number-Up':  'printNumberUp',
            'Print-Orientations-Supported': 'printOrientationsSupported',
            'Print-Owner':  'printOwner',
            'Print-Pages-Per-Minute':   'printPagesPerMinute',
            'Print-Rate':   'printRate',
            'Print-Rate-Unit':  'printRateUnit',
            'Print-Separator-File': 'printSeparatorFile',
            'Print-Share-Name': 'printShareName',
            'Print-Spooling':   'printSpooling',
            'Print-Stapling-Supported': 'printStaplingSupported',
            'Print-Start-Time': 'printStartTime',
            'Print-Status': 'printStatus',
            'Printer-Name': 'printerName',
            'Prior-Set-Time':   'priorSetTime',
            'Prior-Value':  'priorValue',
            'Priority': 'priority',
            'Private-Key':  'privateKey',
            'Privilege-Attributes': 'privilegeAttributes',
            'Privilege-Display-Name':   'privilegeDisplayName',
            'Privilege-Holder': 'privilegeHolder',
            'Privilege-Value':  'privilegeValue',
            'Product-Code': 'productCode',
            'Profile-Path': 'profilePath',
            'Proxied-Object-Name':  'proxiedObjectName',
            'Proxy-Addresses':  'proxyAddresses',
            'Proxy-Generation-Enabled': 'proxyGenerationEnabled',
            'Proxy-Lifetime':   'proxyLifetime',
            'Public-Key-Policy':    'publicKeyPolicy',
            'Purported-Search': 'purportedSearch',
            'Pwd-History-Length':   'pwdHistoryLength',
            'Pwd-Last-Set': 'pwdLastSet',
            'Pwd-Properties':   'pwdProperties',
            'Quality-Of-Service':   'qualityOfService',
            'Query-Filter': 'queryFilter',
            'Query-Policy-BL':  'queryPolicyBL',
            'Query-Policy-Object':  'queryPolicyObject',
            'QueryPoint':   'queryPoint',
            'RDN':  'name',
            'RDN-Att-ID':   'rDNAttID',
            'RID-Allocation-Pool':  'rIDAllocationPool',
            'RID-Available-Pool':   'rIDAvailablePool',
            'RID-Manager-Reference':    'rIDManagerReference',
            'RID-Next-RID': 'rIDNextRID',
            'RID-Previous-Allocation-Pool': 'rIDPreviousAllocationPool',
            'RID-Set-References':   'rIDSetReferences',
            'RID-Used-Pool':    'rIDUsedPool',
            'Range-Lower':  'rangeLower',
            'Range-Upper':  'rangeUpper',
            'Registered-Address':   'registeredAddress',
            'Remote-Server-Name':   'remoteServerName',
            'Remote-Source':    'remoteSource',
            'Remote-Source-Type':   'remoteSourceType',
            'Remote-Storage-GUID':  'remoteStorageGUID',
            'Repl-Interval':    'replInterval',
            'Repl-Property-Meta-Data':  'replPropertyMetaData',
            'Repl-Topology-Stay-Of-Execution':  'replTopologyStayOfExecution',
            'Repl-UpToDate-Vector': 'replUpToDateVector',
            'Replica-Source':   'replicaSource',
            'Reports':  'directReports',
            'Reps-From':    'repsFrom',
            'Reps-To':  'repsTo',
            'Required-Categories':  'requiredCategories',
            'Retired-Repl-DSA-Signatures':  'retiredReplDSASignatures',
            'Revision': 'revision',
            'Rid':  'rid',
            'Rights-Guid':  'rightsGuid',
            'Role-Occupant':    'roleOccupant',
            'Root-Trust':   'rootTrust',
            'SAM-Account-Name': 'sAMAccountName',
            'SAM-Account-Type': 'sAMAccountType',
            'SAM-Domain-Updates':   'samDomainUpdates',
            'SD-Rights-Effective':  'sDRightsEffective',
            'SID-History':  'sIDHistory',
            'SMTP-Mail-Address':    'mailAddress',
            'SPN-Mappings': 'sPNMappings',
            'Schedule': 'schedule',
            'Schema-Flags-Ex':  'schemaFlagsEx',
            'Schema-ID-GUID':   'schemaIDGUID',
            'Schema-Info':  'schemaInfo',
            'Schema-Update':    'schemaUpdate',
            'Schema-Version':   'schemaVersion',
            'Scope-Flags':  'scopeFlags',
            'Script-Path':  'scriptPath',
            'Search-Flags': 'searchFlags',
            'Search-Guide': 'searchGuide',
            'Security-Identifier':  'securityIdentifier',
            'See-Also': 'seeAlso',
            'Seq-Notification': 'seqNotification',
            'Serial-Number':    'serialNumber',
            'Server-Name':  'serverName',
            'Server-Reference': 'serverReference',
            'Server-Reference-BL':  'serverReferenceBL',
            'Server-Role':  'serverRole',
            'Server-State': 'serverState',
            'Service-Binding-Information':  'serviceBindingInformation',
            'Service-Class-ID': 'serviceClassID',
            'Service-Class-Info':   'serviceClassInfo',
            'Service-Class-Name':   'serviceClassName',
            'Service-DNS-Name': 'serviceDNSName',
            'Service-DNS-Name-Type':    'serviceDNSNameType',
            'Service-Instance-Version': 'serviceInstanceVersion',
            'Service-Principal-Name':   'servicePrincipalName',
            'Setup-Command':    'setupCommand',
            'Shell-Context-Menu':   'shellContextMenu',
            'Shell-Property-Pages': 'shellPropertyPages',
            'Short-Server-Name':    'shortServerName',
            'Show-In-Address-Book': 'showInAddressBook',
            'Show-In-Advanced-View-Only':   'showInAdvancedViewOnly',
            'Signature-Algorithms': 'signatureAlgorithms',
            'Site-GUID':    'siteGUID',
            'Site-Link-List':   'siteLinkList',
            'Site-List':    'siteList',
            'Site-Object':  'siteObject',
            'Site-Object-BL':   'siteObjectBL',
            'Site-Server':  'siteServer',
            'State-Or-Province-Name':   'st',
            'Street-Address':   'street',
            'Structural-Object-Class':  'structuralObjectClass',
            'Sub-Class-Of': 'subClassOf',
            'Sub-Refs': 'subRefs',
            'SubSchemaSubEntry':    'subSchemaSubEntry',
            'Super-Scope-Description':  'superScopeDescription',
            'Super-Scopes': 'superScopes',
            'Superior-DNS-Root':    'superiorDNSRoot',
            'Supplemental-Credentials': 'supplementalCredentials',
            'Supported-Application-Context':    'supportedApplicationContext',
            'Surname':  'sn',
            'Sync-Attributes':  'syncAttributes',
            'Sync-Membership':  'syncMembership',
            'Sync-With-Object': 'syncWithObject',
            'Sync-With-SID':    'syncWithSID',
            'System-Auxiliary-Class':   'systemAuxiliaryClass',
            'System-Flags': 'systemFlags',
            'System-May-Contain':   'systemMayContain',
            'System-Must-Contain':  'systemMustContain',
            'System-Only':  'systemOnly',
            'System-Poss-Superiors':    'systemPossSuperiors',
            'Telephone-Number': 'telephoneNumber',
            'Teletex-Terminal-Identifier':  'teletexTerminalIdentifier',
            'Telex-Number': 'telexNumber',
            'Telex-Primary':    'primaryTelexNumber',
            'Template-Roots':   'templateRoots',
            'Template-Roots2':  'templateRoots2',
            'Terminal-Server':  'terminalServer',
            'Text-Country': 'co',
            'Text-Encoded-OR-Address':  'textEncodedORAddress',
            'Time-Refresh': 'timeRefresh',
            'Time-Vol-Change':  'timeVolChange',
            'Title':    'title',
            'Token-Groups': 'tokenGroups',
            'Token-Groups-Global-And-Universal':    'tokenGroupsGlobalAndUniversal',
            'Token-Groups-No-GC-Acceptable':    'tokenGroupsNoGCAcceptable',
            'Tombstone-Lifetime':   'tombstoneLifetime',
            'Transport-Address-Attribute':  'transportAddressAttribute',
            'Transport-DLL-Name':   'transportDLLName',
            'Transport-Type':   'transportType',
            'Treat-As-Leaf':    'treatAsLeaf',
            'Tree-Name':    'treeName',
            'Trust-Attributes': 'trustAttributes',
            'Trust-Auth-Incoming':  'trustAuthIncoming',
            'Trust-Auth-Outgoing':  'trustAuthOutgoing',
            'Trust-Direction':  'trustDirection',
            'Trust-Parent': 'trustParent',
            'Trust-Partner':    'trustPartner',
            'Trust-Posix-Offset':   'trustPosixOffset',
            'Trust-Type':   'trustType',
            'UAS-Compat':   'uASCompat',
            'UNC-Name': 'uNCName',
            'UPN-Suffixes': 'uPNSuffixes',
            'USN-Changed':  'uSNChanged',
            'USN-Created':  'uSNCreated',
            'USN-DSA-Last-Obj-Removed': 'uSNDSALastObjRemoved',
            'USN-Intersite':    'USNIntersite',
            'USN-Last-Obj-Rem': 'uSNLastObjRem',
            'USN-Source':   'uSNSource',
            'Unicode-Pwd':  'unicodePwd',
            'Upgrade-Product-Code': 'upgradeProductCode',
            'User-Account-Control': 'userAccountControl',
            'User-Cert':    'userCert',
            'User-Comment': 'comment',
            'User-Parameters':  'userParameters',
            'User-Password':    'userPassword',
            'User-Principal-Name':  'userPrincipalName',
            'User-SMIME-Certificate':   'userSMIMECertificate',
            'User-Shared-Folder':   'userSharedFolder',
            'User-Shared-Folder-Other': 'userSharedFolderOther',
            'User-Workstations':    'userWorkstations',
            'Valid-Accesses':   'validAccesses',
            'Vendor':   'vendor',
            'Version-Number':   'versionNumber',
            'Version-Number-Hi':    'versionNumberHi',
            'Version-Number-Lo':    'versionNumberLo',
            'Vol-Table-GUID':   'volTableGUID',
            'Vol-Table-Idx-GUID':   'volTableIdxGUID',
            'Volume-Count': 'volumeCount',
            'WWW-Home-Page':    'wWWHomePage',
            'WWW-Page-Other':   'url',
            'Wbem-Path':    'wbemPath',
            'Well-Known-Objects':   'wellKnownObjects',
            'When-Changed': 'whenChanged',
            'When-Created': 'whenCreated',
            'Winsock-Addresses':    'winsockAddresses',
            'X121-Address': 'x121Address',
            'X509-Cert':    'userCertificate',
            'associatedDomain': 'associatedDomain',
            'associatedName':   'associatedName',
            'attributeCertificateAttribute':    'attributeCertificateAttribute',
            'audio':    'audio',
            'bootFile': 'bootFile',
            'bootParameter':    'bootParameter',
            'buildingName': 'buildingName',
            'carLicense':   'carLicense',
            'departmentNumber': 'departmentNumber',
            'dhcp-Classes': 'dhcpClasses',
            'dhcp-Flags':   'dhcpFlags',
            'dhcp-Identification':  'dhcpIdentification',
            'dhcp-Mask':    'dhcpMask',
            'dhcp-MaxKey':  'dhcpMaxKey',
            'dhcp-Obj-Description': 'dhcpObjDescription',
            'dhcp-Obj-Name':    'dhcpObjName',
            'dhcp-Options': 'dhcpOptions',
            'dhcp-Properties':  'dhcpProperties',
            'dhcp-Ranges':  'dhcpRanges',
            'dhcp-Reservations':    'dhcpReservations',
            'dhcp-Servers': 'dhcpServers',
            'dhcp-Sites':   'dhcpSites',
            'dhcp-State':   'dhcpState',
            'dhcp-Subnets': 'dhcpSubnets',
            'dhcp-Type':    'dhcpType',
            'dhcp-Unique-Key':  'dhcpUniqueKey',
            'dhcp-Update-Time': 'dhcpUpdateTime',
            'documentAuthor':   'documentAuthor',
            'documentIdentifier':   'documentIdentifier',
            'documentLocation': 'documentLocation',
            'documentPublisher':    'documentPublisher',
            'documentTitle':    'documentTitle',
            'documentVersion':  'documentVersion',
            'drink':    'drink',
            'gecos':    'gecos',
            'gidNumber':    'gidNumber',
            'host': 'host',
            'houseIdentifier':  'houseIdentifier',
            'ipHostNumber': 'ipHostNumber',
            'ipNetmaskNumber':  'ipNetmaskNumber',
            'ipNetworkNumber':  'ipNetworkNumber',
            'ipProtocolNumber': 'ipProtocolNumber',
            'ipServicePort':    'ipServicePort',
            'ipServiceProtocol':    'ipServiceProtocol',
            'jpegPhoto':    'jpegPhoto',
            'labeledURI':   'labeledURI',
            'loginShell':   'loginShell',
            'macAddress':   'macAddress',
            'meetingAdvertiseScope':    'meetingAdvertiseScope',
            'meetingApplication':   'meetingApplication',
            'meetingBandwidth': 'meetingBandwidth',
            'meetingBlob':  'meetingBlob',
            'meetingContactInfo':   'meetingContactInfo',
            'meetingDescription':   'meetingDescription',
            'meetingEndTime':   'meetingEndTime',
            'meetingID':    'meetingID',
            'meetingIP':    'meetingIP',
            'meetingIsEncrypted':   'meetingIsEncrypted',
            'meetingKeyword':   'meetingKeyword',
            'meetingLanguage':  'meetingLanguage',
            'meetingLocation':  'meetingLocation',
            'meetingMaxParticipants':   'meetingMaxParticipants',
            'meetingName':  'meetingName',
            'meetingOriginator':    'meetingOriginator',
            'meetingOwner': 'meetingOwner',
            'meetingProtocol':  'meetingProtocol',
            'meetingRating':    'meetingRating',
            'meetingRecurrence':    'meetingRecurrence',
            'meetingScope': 'meetingScope',
            'meetingStartTime': 'meetingStartTime',
            'meetingType':  'meetingType',
            'meetingURL':   'meetingURL',
            'memberNisNetgroup':    'memberNisNetgroup',
            'memberUid':    'memberUid',
            'ms-Authz-Central-Access-Policy-ID':    'msAuthz-CentralAccessPolicyID',
            'ms-Authz-Effective-Security-Policy':   'msAuthz-EffectiveSecurityPolicy',
            'ms-Authz-Last-Effective-Security-Policy':  'msAuthz-LastEffectiveSecurityPolicy',
            'ms-Authz-Member-Rules-In-Central-Access-Policy':   'msAuthz-MemberRulesInCentralAccessPolicy',
            'ms-Authz-Member-Rules-In-Central-Access-Policy-BL':    'msAuthz-MemberRulesInCentralAccessPolicyBL',
            'ms-Authz-Proposed-Security-Policy':    'msAuthz-ProposedSecurityPolicy',
            'ms-Authz-Resource-Condition':  'msAuthz-ResourceCondition',
            'ms-COM-DefaultPartitionLink':  'msCOM-DefaultPartitionLink',
            'ms-COM-ObjectId':  'msCOM-ObjectId',
            'ms-COM-PartitionLink': 'msCOM-PartitionLink',
            'ms-COM-PartitionSetLink':  'msCOM-PartitionSetLink',
            'ms-COM-UserLink':  'msCOM-UserLink',
            'ms-COM-UserPartitionSetLink':  'msCOM-UserPartitionSetLink',
            'ms-DFS-Comment-v2':    'msDFS-Commentv2',
            'ms-DFS-Generation-GUID-v2':    'msDFS-GenerationGUIDv2',
            'ms-DFS-Last-Modified-v2':  'msDFS-LastModifiedv2',
            'ms-DFS-Link-Identity-GUID-v2': 'msDFS-LinkIdentityGUIDv2',
            'ms-DFS-Link-Path-v2':  'msDFS-LinkPathv2',
            'ms-DFS-Link-Security-Descriptor-v2':   'msDFS-LinkSecurityDescriptorv2',
            'ms-DFS-Namespace-Identity-GUID-v2':    'msDFS-NamespaceIdentityGUIDv2',
            'ms-DFS-Properties-v2': 'msDFS-Propertiesv2',
            'ms-DFS-Schema-Major-Version':  'msDFS-SchemaMajorVersion',
            'ms-DFS-Schema-Minor-Version':  'msDFS-SchemaMinorVersion',
            'ms-DFS-Short-Name-Link-Path-v2':   'msDFS-ShortNameLinkPathv2',
            'ms-DFS-Target-List-v2':    'msDFS-TargetListv2',
            'ms-DFS-Ttl-v2':    'msDFS-Ttlv2',
            'ms-DFSR-CachePolicy':  'msDFSR-CachePolicy',
            'ms-DFSR-CommonStagingPath':    'msDFSR-CommonStagingPath',
            'ms-DFSR-CommonStagingSizeInMb':    'msDFSR-CommonStagingSizeInMb',
            'ms-DFSR-ComputerReference':    'msDFSR-ComputerReference',
            'ms-DFSR-ComputerReferenceBL':  'msDFSR-ComputerReferenceBL',
            'ms-DFSR-ConflictPath': 'msDFSR-ConflictPath',
            'ms-DFSR-ConflictSizeInMb': 'msDFSR-ConflictSizeInMb',
            'ms-DFSR-ContentSetGuid':   'msDFSR-ContentSetGuid',
            'ms-DFSR-DefaultCompressionExclusionFilter':    'msDFSR-DefaultCompressionExclusionFilter',
            'ms-DFSR-DeletedPath':  'msDFSR-DeletedPath',
            'ms-DFSR-DeletedSizeInMb':  'msDFSR-DeletedSizeInMb',
            'ms-DFSR-DfsLinkTarget':    'msDFSR-DfsLinkTarget',
            'ms-DFSR-DfsPath':  'msDFSR-DfsPath',
            'ms-DFSR-DirectoryFilter':  'msDFSR-DirectoryFilter',
            'ms-DFSR-DisablePacketPrivacy': 'msDFSR-DisablePacketPrivacy',
            'ms-DFSR-Enabled':  'msDFSR-Enabled',
            'ms-DFSR-Extension':    'msDFSR-Extension',
            'ms-DFSR-FileFilter':   'msDFSR-FileFilter',
            'ms-DFSR-Flags':    'msDFSR-Flags',
            'ms-DFSR-Keywords': 'msDFSR-Keywords',
            'ms-DFSR-MaxAgeInCacheInMin':   'msDFSR-MaxAgeInCacheInMin',
            'ms-DFSR-MemberReference':  'msDFSR-MemberReference',
            'ms-DFSR-MemberReferenceBL':    'msDFSR-MemberReferenceBL',
            'ms-DFSR-MinDurationCacheInMin':    'msDFSR-MinDurationCacheInMin',
            'ms-DFSR-OnDemandExclusionDirectoryFilter': 'msDFSR-OnDemandExclusionDirectoryFilter',
            'ms-DFSR-OnDemandExclusionFileFilter':  'msDFSR-OnDemandExclusionFileFilter',
            'ms-DFSR-Options':  'msDFSR-Options',
            'ms-DFSR-Options2': 'msDFSR-Options2',
            'ms-DFSR-Priority': 'msDFSR-Priority',
            'ms-DFSR-RdcEnabled':   'msDFSR-RdcEnabled',
            'ms-DFSR-RdcMinFileSizeInKb':   'msDFSR-RdcMinFileSizeInKb',
            'ms-DFSR-ReadOnly': 'msDFSR-ReadOnly',
            'ms-DFSR-ReplicationGroupGuid': 'msDFSR-ReplicationGroupGuid',
            'ms-DFSR-ReplicationGroupType': 'msDFSR-ReplicationGroupType',
            'ms-DFSR-RootFence':    'msDFSR-RootFence',
            'ms-DFSR-RootPath': 'msDFSR-RootPath',
            'ms-DFSR-RootSizeInMb': 'msDFSR-RootSizeInMb',
            'ms-DFSR-Schedule': 'msDFSR-Schedule',
            'ms-DFSR-StagingCleanupTriggerInPercent':   'msDFSR-StagingCleanupTriggerInPercent',
            'ms-DFSR-StagingPath':  'msDFSR-StagingPath',
            'ms-DFSR-StagingSizeInMb':  'msDFSR-StagingSizeInMb',
            'ms-DFSR-TombstoneExpiryInMin': 'msDFSR-TombstoneExpiryInMin',
            'ms-DFSR-Version':  'msDFSR-Version',
            'ms-DNS-DNSKEY-Record-Set-TTL': 'msDNS-DNSKEYRecordSetTTL',
            'ms-DNS-DNSKEY-Records':    'msDNS-DNSKEYRecords',
            'ms-DNS-DS-Record-Algorithms':  'msDNS-DSRecordAlgorithms',
            'ms-DNS-DS-Record-Set-TTL': 'msDNS-DSRecordSetTTL',
            'ms-DNS-Is-Signed': 'msDNS-IsSigned',
            'ms-DNS-Keymaster-Zones':   'msDNS-KeymasterZones',
            'ms-DNS-Maintain-Trust-Anchor': 'msDNS-MaintainTrustAnchor',
            'ms-DNS-NSEC3-Current-Salt':    'msDNS-NSEC3CurrentSalt',
            'ms-DNS-NSEC3-Hash-Algorithm':  'msDNS-NSEC3HashAlgorithm',
            'ms-DNS-NSEC3-Iterations':  'msDNS-NSEC3Iterations',
            'ms-DNS-NSEC3-OptOut':  'msDNS-NSEC3OptOut',
            'ms-DNS-NSEC3-Random-Salt-Length':  'msDNS-NSEC3RandomSaltLength',
            'ms-DNS-NSEC3-User-Salt':   'msDNS-NSEC3UserSalt',
            'ms-DNS-Parent-Has-Secure-Delegation':  'msDNS-ParentHasSecureDelegation',
            'ms-DNS-Propagation-Time':  'msDNS-PropagationTime',
            'ms-DNS-RFC5011-Key-Rollovers': 'msDNS-RFC5011KeyRollovers',
            'ms-DNS-Secure-Delegation-Polling-Period':  'msDNS-SecureDelegationPollingPeriod',
            'ms-DNS-Sign-With-NSEC3':   'msDNS-SignWithNSEC3',
            'ms-DNS-Signature-Inception-Offset':    'msDNS-SignatureInceptionOffset',
            'ms-DNS-Signing-Key-Descriptors':   'msDNS-SigningKeyDescriptors',
            'ms-DNS-Signing-Keys':  'msDNS-SigningKeys',
            'ms-DS-Additional-Dns-Host-Name':   'msDS-AdditionalDnsHostName',
            'ms-DS-Additional-Sam-Account-Name':    'msDS-AdditionalSamAccountName',
            'ms-DS-Allowed-DNS-Suffixes':   'msDS-AllowedDNSSuffixes',
            'ms-DS-Allowed-To-Act-On-Behalf-Of-Other-Identity': 'msDS-AllowedToActOnBehalfOfOtherIdentity',
            'ms-DS-Allowed-To-Delegate-To': 'msDS-AllowedToDelegateTo',
            'ms-DS-Applies-To-Resource-Types':  'msDS-AppliesToResourceTypes',
            'ms-DS-Approx-Immed-Subordinates':  'msDS-Approx-Immed-Subordinates',
            'ms-DS-AuthenticatedAt-DC': 'msDS-AuthenticatedAtDC',
            'ms-DS-AuthenticatedTo-Accountlist':    'msDS-AuthenticatedToAccountlist',
            'ms-DS-Auxiliary-Classes':  'msDS-Auxiliary-Classes',
            'ms-DS-Az-Application-Data':    'msDS-AzApplicationData',
            'ms-DS-Az-Application-Name':    'msDS-AzApplicationName',
            'ms-DS-Az-Application-Version': 'msDS-AzApplicationVersion',
            'ms-DS-Az-Biz-Rule':    'msDS-AzBizRule',
            'ms-DS-Az-Biz-Rule-Language':   'msDS-AzBizRuleLanguage',
            'ms-DS-Az-Class-ID':    'msDS-AzClassId',
            'ms-DS-Az-Domain-Timeout':  'msDS-AzDomainTimeout',
            'ms-DS-Az-Generate-Audits': 'msDS-AzGenerateAudits',
            'ms-DS-Az-Generic-Data':    'msDS-AzGenericData',
            'ms-DS-Az-LDAP-Query':  'msDS-AzLDAPQuery',
            'ms-DS-Az-Last-Imported-Biz-Rule-Path': 'msDS-AzLastImportedBizRulePath',
            'ms-DS-Az-Major-Version':   'msDS-AzMajorVersion',
            'ms-DS-Az-Minor-Version':   'msDS-AzMinorVersion',
            'ms-DS-Az-Object-Guid': 'msDS-AzObjectGuid',
            'ms-DS-Az-Operation-ID':    'msDS-AzOperationID',
            'ms-DS-Az-Scope-Name':  'msDS-AzScopeName',
            'ms-DS-Az-Script-Engine-Cache-Max': 'msDS-AzScriptEngineCacheMax',
            'ms-DS-Az-Script-Timeout':  'msDS-AzScriptTimeout',
            'ms-DS-Az-Task-Is-Role-Definition': 'msDS-AzTaskIsRoleDefinition',
            'ms-DS-Behavior-Version':   'msDS-Behavior-Version',
            'ms-DS-BridgeHead-Servers-Used':    'msDS-BridgeHeadServersUsed',
            'ms-DS-Byte-Array': 'msDS-ByteArray',
            'ms-DS-Cached-Membership':  'msDS-Cached-Membership',
            'ms-DS-Cached-Membership-Time-Stamp':   'msDS-Cached-Membership-Time-Stamp',
            'ms-DS-Claim-Attribute-Source': 'msDS-ClaimAttributeSource',
            'ms-DS-Claim-Is-Single-Valued': 'msDS-ClaimIsSingleValued',
            'ms-DS-Claim-Is-Value-Space-Restricted':    'msDS-ClaimIsValueSpaceRestricted',
            'ms-DS-Claim-Possible-Values':  'msDS-ClaimPossibleValues',
            'ms-DS-Claim-Shares-Possible-Values-With':  'msDS-ClaimSharesPossibleValuesWith',
            'ms-DS-Claim-Shares-Possible-Values-With-BL':   'msDS-ClaimSharesPossibleValuesWithBL',
            'ms-DS-Claim-Source':   'msDS-ClaimSource',
            'ms-DS-Claim-Source-Type':  'msDS-ClaimSourceType',
            'ms-DS-Claim-Type-Applies-To-Class':    'msDS-ClaimTypeAppliesToClass',
            'ms-DS-Claim-Value-Type':   'msDS-ClaimValueType',
            'ms-DS-Date-Time':  'msDS-DateTime',
            'ms-DS-Default-Quota':  'msDS-DefaultQuota',
            'ms-DS-Deleted-Object-Lifetime':    'msDS-DeletedObjectLifetime',
            'ms-DS-Disable-For-Instances':  'msDS-DisableForInstances',
            'ms-DS-Disable-For-Instances-BL':   'msDS-DisableForInstancesBL',
            'ms-DS-DnsRootAlias':   'msDS-DnsRootAlias',
            'ms-DS-Egress-Claims-Transformation-Policy':    'msDS-EgressClaimsTransformationPolicy',
            'ms-DS-Enabled-Feature':    'msDS-EnabledFeature',
            'ms-DS-Enabled-Feature-BL': 'msDS-EnabledFeatureBL',
            'ms-DS-Entry-Time-To-Die':  'msDS-Entry-Time-To-Die',
            'ms-DS-ExecuteScriptPassword':  'msDS-ExecuteScriptPassword',
            'ms-DS-External-Key':   'msDS-ExternalKey',
            'ms-DS-External-Store': 'msDS-ExternalStore',
            'ms-DS-Failed-Interactive-Logon-Count': 'msDS-FailedInteractiveLogonCount',
            'ms-DS-Failed-Interactive-Logon-Count-At-Last-Successful-Logon':    'msDS-FailedInteractiveLogonCountAtLastSuccessfulLogon',
            'ms-DS-Filter-Containers':  'msDS-FilterContainers',
            'ms-DS-Generation-Id':  'msDS-GenerationId',
            'ms-DS-GeoCoordinates-Altitude':    'msDS-GeoCoordinatesAltitude',
            'ms-DS-GeoCoordinates-Latitude':    'msDS-GeoCoordinatesLatitude',
            'ms-DS-GeoCoordinates-Longitude':   'msDS-GeoCoordinatesLongitude',
            'ms-DS-GroupMSAMembership': 'msDS-GroupMSAMembership',
            'ms-DS-HAB-Seniority-Index':    'msDS-HABSeniorityIndex',
            'ms-DS-Has-Domain-NCs': 'msDS-HasDomainNCs',
            'ms-DS-Has-Full-Replica-NCs':   'msDS-hasFullReplicaNCs',
            'ms-DS-Has-Instantiated-NCs':   'msDS-HasInstantiatedNCs',
            'ms-DS-Has-Master-NCs': 'msDS-hasMasterNCs',
            'ms-DS-Host-Service-Account':   'msDS-HostServiceAccount',
            'ms-DS-Host-Service-Account-BL':    'msDS-HostServiceAccountBL',
            'ms-DS-Ingress-Claims-Transformation-Policy':   'msDS-IngressClaimsTransformationPolicy',
            'ms-DS-IntId':  'msDS-IntId',
            'ms-DS-Integer':    'msDS-Integer',
            'ms-DS-Is-Domain-For':  'msDS-IsDomainFor',
            'ms-DS-Is-Full-Replica-For':    'msDS-IsFullReplicaFor',
            'ms-DS-Is-Partial-Replica-For': 'msDS-IsPartialReplicaFor',
            'ms-DS-Is-Possible-Values-Present': 'msDS-IsPossibleValuesPresent',
            'ms-DS-Is-Primary-Computer-For':    'msDS-IsPrimaryComputerFor',
            'ms-DS-Is-Used-As-Resource-Security-Attribute': 'msDS-IsUsedAsResourceSecurityAttribute',
            'ms-DS-Is-User-Cachable-At-Rodc':   'msDS-IsUserCachableAtRodc',
            'ms-DS-KeyVersionNumber':   'msDS-KeyVersionNumber',
            'ms-DS-KrbTgt-Link':    'msDS-KrbTgtLink',
            'ms-DS-KrbTgt-Link-BL': 'msDS-KrbTgtLinkBl',
            'ms-DS-Last-Failed-Interactive-Logon-Time': 'msDS-LastFailedInteractiveLogonTime',
            'ms-DS-Last-Known-RDN': 'msDS-LastKnownRDN',
            'ms-DS-Last-Successful-Interactive-Logon-Time': 'msDS-LastSuccessfulInteractiveLogonTime',
            'ms-DS-Lockout-Duration':   'msDS-LockoutDuration',
            'ms-DS-Lockout-Observation-Window': 'msDS-LockoutObservationWindow',
            'ms-DS-Lockout-Threshold':  'msDS-LockoutThreshold',
            'ms-DS-Logon-Time-Sync-Interval':   'msDS-LogonTimeSyncInterval',
            'ms-DS-ManagedPassword':    'msDS-ManagedPassword',
            'ms-DS-ManagedPasswordId':  'msDS-ManagedPasswordId',
            'ms-DS-ManagedPasswordInterval':    'msDS-ManagedPasswordInterval',
            'ms-DS-ManagedPasswordPreviousId':  'msDS-ManagedPasswordPreviousId',
            'ms-DS-Mastered-By':    'msDs-masteredBy',
            'ms-DS-Max-Values': 'msDs-MaxValues',
            'ms-DS-Maximum-Password-Age':   'msDS-MaximumPasswordAge',
            'ms-DS-Members-For-Az-Role':    'msDS-MembersForAzRole',
            'ms-DS-Members-For-Az-Role-BL': 'msDS-MembersForAzRoleBL',
            'ms-DS-Members-Of-Resource-Property-List':  'msDS-MembersOfResourcePropertyList',
            'ms-DS-Members-Of-Resource-Property-List-BL':   'msDS-MembersOfResourcePropertyListBL',
            'ms-DS-Minimum-Password-Age':   'msDS-MinimumPasswordAge',
            'ms-DS-Minimum-Password-Length':    'msDS-MinimumPasswordLength',
            'ms-DS-NC-RO-Replica-Locations':    'msDS-NC-RO-Replica-Locations',
            'ms-DS-NC-RO-Replica-Locations-BL': 'msDS-NC-RO-Replica-Locations-BL',
            'ms-DS-NC-Repl-Cursors':    'msDS-NCReplCursors',
            'ms-DS-NC-Repl-Inbound-Neighbors':  'msDS-NCReplInboundNeighbors',
            'ms-DS-NC-Repl-Outbound-Neighbors': 'msDS-NCReplOutboundNeighbors',
            'ms-DS-NC-Replica-Locations':   'msDS-NC-Replica-Locations',
            'ms-DS-NC-Type':    'msDS-NcType',
            'ms-DS-Never-Reveal-Group': 'msDS-NeverRevealGroup',
            'ms-DS-Non-Members':    'msDS-NonMembers',
            'ms-DS-Non-Members-BL': 'msDS-NonMembersBL',
            'ms-DS-Non-Security-Group-Extra-Classes':   'msDS-Non-Security-Group-Extra-Classes',
            'ms-DS-OIDToGroup-Link':    'msDS-OIDToGroupLink',
            'ms-DS-OIDToGroup-Link-BL': 'msDS-OIDToGroupLinkBl',
            'ms-DS-Object-Reference':   'msDS-ObjectReference',
            'ms-DS-Object-Reference-BL':    'msDS-ObjectReferenceBL',
            'ms-DS-Operations-For-Az-Role': 'msDS-OperationsForAzRole',
            'ms-DS-Operations-For-Az-Role-BL':  'msDS-OperationsForAzRoleBL',
            'ms-DS-Operations-For-Az-Task': 'msDS-OperationsForAzTask',
            'ms-DS-Operations-For-Az-Task-BL':  'msDS-OperationsForAzTaskBL',
            'ms-DS-Optional-Feature-Flags': 'msDS-OptionalFeatureFlags',
            'ms-DS-Optional-Feature-GUID':  'msDS-OptionalFeatureGUID',
            'ms-DS-Other-Settings': 'msDS-Other-Settings',
            'ms-DS-PSO-Applied':    'msDS-PSOApplied',
            'ms-DS-PSO-Applies-To': 'msDS-PSOAppliesTo',
            'ms-DS-Password-Complexity-Enabled':    'msDS-PasswordComplexityEnabled',
            'ms-DS-Password-History-Length':    'msDS-PasswordHistoryLength',
            'ms-DS-Password-Reversible-Encryption-Enabled': 'msDS-PasswordReversibleEncryptionEnabled',
            'ms-DS-Password-Settings-Precedence':   'msDS-PasswordSettingsPrecedence',
            'ms-DS-Phonetic-Company-Name':  'msDS-PhoneticCompanyName',
            'ms-DS-Phonetic-Department':    'msDS-PhoneticDepartment',
            'ms-DS-Phonetic-Display-Name':  'msDS-PhoneticDisplayName',
            'ms-DS-Phonetic-First-Name':    'msDS-PhoneticFirstName',
            'ms-DS-Phonetic-Last-Name': 'msDS-PhoneticLastName',
            'ms-DS-Port-LDAP':  'msDS-PortLDAP',
            'ms-DS-Port-SSL':   'msDS-PortSSL',
            'ms-DS-Preferred-GC-Site':  'msDS-Preferred-GC-Site',
            'ms-DS-Primary-Computer':   'msDS-PrimaryComputer',
            'ms-DS-Principal-Name': 'msDS-PrincipalName',
            'ms-DS-Promotion-Settings': 'msDS-PromotionSettings',
            'ms-DS-Quota-Amount':   'msDS-QuotaAmount',
            'ms-DS-Quota-Effective':    'msDS-QuotaEffective',
            'ms-DS-Quota-Trustee':  'msDS-QuotaTrustee',
            'ms-DS-Quota-Used': 'msDS-QuotaUsed',
            'ms-DS-Repl-Attribute-Meta-Data':   'msDS-ReplAttributeMetaData',
            'ms-DS-Repl-Authentication-Mode':   'msDS-ReplAuthenticationMode',
            'ms-DS-Repl-Value-Meta-Data':   'msDS-ReplValueMetaData',
            'ms-DS-Replication-Notify-First-DSA-Delay': 'msDS-Replication-Notify-First-DSA-Delay',
            'ms-DS-Replication-Notify-Subsequent-DSA-Delay':    'msDS-Replication-Notify-Subsequent-DSA-Delay',
            'ms-DS-ReplicationEpoch':   'msDS-ReplicationEpoch',
            'ms-DS-Required-Domain-Behavior-Version':   'msDS-RequiredDomainBehaviorVersion',
            'ms-DS-Required-Forest-Behavior-Version':   'msDS-RequiredForestBehaviorVersion',
            'ms-DS-Resultant-PSO':  'msDS-ResultantPSO',
            'ms-DS-Retired-Repl-NC-Signatures': 'msDS-RetiredReplNCSignatures',
            'ms-DS-Reveal-OnDemand-Group':  'msDS-RevealOnDemandGroup',
            'ms-DS-Revealed-DSAs':  'msDS-RevealedDSAs',
            'ms-DS-Revealed-List':  'msDS-RevealedList',
            'ms-DS-Revealed-List-BL':   'msDS-RevealedListBL',
            'ms-DS-Revealed-Users': 'msDS-RevealedUsers',
            'ms-DS-SCP-Container':  'msDS-SCPContainer',
            'ms-DS-SD-Reference-Domain':    'msDS-SDReferenceDomain',
            'ms-DS-SPN-Suffixes':   'msDS-SPNSuffixes',
            'ms-DS-Secondary-KrbTgt-Number':    'msDS-SecondaryKrbTgtNumber',
            'ms-DS-Security-Group-Extra-Classes':   'msDS-Security-Group-Extra-Classes',
            'ms-DS-Seniority-Index':    'msDS-SeniorityIndex',
            'ms-DS-Service-Account':    'msDS-ServiceAccount',
            'ms-DS-Service-Account-BL': 'msDS-ServiceAccountBL',
            'ms-DS-Service-Account-DNS-Domain': 'msDS-ServiceAccountDNSDomain',
            'ms-DS-Settings':   'msDS-Settings',
            'ms-DS-Site-Affinity':  'msDS-Site-Affinity',
            'ms-DS-SiteName':   'msDS-SiteName',
            'ms-DS-Source-Object-DN':   'msDS-SourceObjectDN',
            'ms-DS-Supported-Encryption-Types': 'msDS-SupportedEncryptionTypes',
            'ms-DS-TDO-Egress-BL':  'msDS-TDOEgressBL',
            'ms-DS-TDO-Ingress-BL': 'msDS-TDOIngressBL',
            'ms-DS-Tasks-For-Az-Role':  'msDS-TasksForAzRole',
            'ms-DS-Tasks-For-Az-Role-BL':   'msDS-TasksForAzRoleBL',
            'ms-DS-Tasks-For-Az-Task':  'msDS-TasksForAzTask',
            'ms-DS-Tasks-For-Az-Task-BL':   'msDS-TasksForAzTaskBL',
            'ms-DS-Tombstone-Quota-Factor': 'msDS-TombstoneQuotaFactor',
            'ms-DS-Top-Quota-Usage':    'msDS-TopQuotaUsage',
            'ms-DS-Transformation-Rules':   'msDS-TransformationRules',
            'ms-DS-Transformation-Rules-Compiled':  'msDS-TransformationRulesCompiled',
            'ms-DS-Trust-Forest-Trust-Info':    'msDS-TrustForestTrustInfo',
            'ms-DS-USN-Last-Sync-Success':  'msDS-USNLastSyncSuccess',
            'ms-DS-UpdateScript':   'msDS-UpdateScript',
            'ms-DS-User-Account-Auto-Locked':   'ms-DS-UserAccountAutoLocked',
            'ms-DS-User-Account-Control-Computed':  'msDS-User-Account-Control-Computed',
            'ms-DS-User-Account-Disabled':  'msDS-UserAccountDisabled',
            'ms-DS-User-Dont-Expire-Password':  'msDS-UserDontExpirePassword',
            'ms-DS-User-Encrypted-Text-Password-Allowed':   'ms-DS-UserEncryptedTextPasswordAllowed',
            'ms-DS-User-Password-Expired':  'msDS-UserPasswordExpired',
            'ms-DS-User-Password-Expiry-Time-Computed': 'msDS-UserPasswordExpiryTimeComputed',
            'ms-DS-User-Password-Not-Required': 'ms-DS-UserPasswordNotRequired',
            'ms-DS-Value-Type-Reference':   'msDS-ValueTypeReference',
            'ms-DS-Value-Type-Reference-BL':    'msDS-ValueTypeReferenceBL',
            'ms-DS-isGC':   'msDS-isGC',
            'ms-DS-isRODC': 'msDS-isRODC',
            'ms-DS-local-Effective-Deletion-Time':  'msDS-LocalEffectiveDeletionTime',
            'ms-DS-local-Effective-Recycle-Time':   'msDS-LocalEffectiveRecycleTime',
            'ms-Exch-Assistant-Name':   'msExchAssistantName',
            'ms-Exch-House-Identifier': 'msExchHouseIdentifier',
            'ms-Exch-LabeledURI':   'msExchLabeledURI',
            'ms-Exch-Owner-BL': 'ownerBL',
            'ms-FRS-Hub-Member':    'msFRS-Hub-Member',
            'ms-FRS-Topology-Pref': 'msFRS-Topology-Pref',
            'ms-FVE-KeyPackage':    'msFVE-KeyPackage',
            'ms-FVE-RecoveryGuid':  'msFVE-RecoveryGuid',
            'ms-FVE-RecoveryPassword':  'msFVE-RecoveryPassword',
            'ms-FVE-VolumeGuid':    'msFVE-VolumeGuid',
            'ms-IIS-FTP-Dir':   'msIIS-FTPDir',
            'ms-IIS-FTP-Root':  'msIIS-FTPRoot',
            'ms-Imaging-Hash-Algorithm':    'msImaging-HashAlgorithm',
            'ms-Imaging-PSP-Identifier':    'msImaging-PSPIdentifier',
            'ms-Imaging-PSP-String':    'msImaging-PSPString',
            'ms-Imaging-Thumbprint-Hash':   'msImaging-ThumbprintHash',
            'ms-Kds-CreateTime':    'msKds-CreateTime',
            'ms-Kds-DomainID':  'msKds-DomainID',
            'ms-Kds-KDF-AlgorithmID':   'msKds-KDFAlgorithmID',
            'ms-Kds-KDF-Param': 'msKds-KDFParam',
            'ms-Kds-PrivateKey-Length': 'msKds-PrivateKeyLength',
            'ms-Kds-PublicKey-Length':  'msKds-PublicKeyLength',
            'ms-Kds-RootKeyData':   'msKds-RootKeyData',
            'ms-Kds-SecretAgreement-AlgorithmID':   'msKds-SecretAgreementAlgorithmID',
            'ms-Kds-SecretAgreement-Param': 'msKds-SecretAgreementParam',
            'ms-Kds-UseStartTime':  'msKds-UseStartTime',
            'ms-Kds-Version':   'msKds-Version',
            'ms-PKI-AccountCredentials':    'msPKIAccountCredentials',
            'ms-PKI-Cert-Template-OID': 'msPKI-Cert-Template-OID',
            'ms-PKI-Certificate-Application-Policy':    'msPKI-Certificate-Application-Policy',
            'ms-PKI-Certificate-Name-Flag': 'msPKI-Certificate-Name-Flag',
            'ms-PKI-Certificate-Policy':    'msPKI-Certificate-Policy',
            'ms-PKI-Credential-Roaming-Tokens': 'msPKI-CredentialRoamingTokens',
            'ms-PKI-DPAPIMasterKeys':   'msPKIDPAPIMasterKeys',
            'ms-PKI-Enrollment-Flag':   'msPKI-Enrollment-Flag',
            'ms-PKI-Enrollment-Servers':    'msPKI-Enrollment-Servers',
            'ms-PKI-Minimal-Key-Size':  'msPKI-Minimal-Key-Size',
            'ms-PKI-OID-Attribute': 'msPKI-OID-Attribute',
            'ms-PKI-OID-CPS':   'msPKI-OID-CPS',
            'ms-PKI-OID-LocalizedName': 'msPKI-OIDLocalizedName',
            'ms-PKI-OID-User-Notice':   'msPKI-OID-User-Notice',
            'ms-PKI-Private-Key-Flag':  'msPKI-Private-Key-Flag',
            'ms-PKI-RA-Application-Policies':   'msPKI-RA-Application-Policies',
            'ms-PKI-RA-Policies':   'msPKI-RA-Policies',
            'ms-PKI-RA-Signature':  'msPKI-RA-Signature',
            'ms-PKI-RoamingTimeStamp':  'msPKIRoamingTimeStamp',
            'ms-PKI-Site-Name': 'msPKI-Site-Name',
            'ms-PKI-Supersede-Templates':   'msPKI-Supersede-Templates',
            'ms-PKI-Template-Minor-Revision':   'msPKI-Template-Minor-Revision',
            'ms-PKI-Template-Schema-Version':   'msPKI-Template-Schema-Version',
            'ms-RADIUS-FramedInterfaceId':  'msRADIUS-FramedInterfaceId',
            'ms-RADIUS-FramedIpv6Prefix':   'msRADIUS-FramedIpv6Prefix',
            'ms-RADIUS-FramedIpv6Route':    'msRADIUS-FramedIpv6Route',
            'ms-RADIUS-SavedFramedInterfaceId': 'msRADIUS-SavedFramedInterfaceId',
            'ms-RADIUS-SavedFramedIpv6Prefix':  'msRADIUS-SavedFramedIpv6Prefix',
            'ms-RADIUS-SavedFramedIpv6Route':   'msRADIUS-SavedFramedIpv6Route',
            'ms-RRAS-Attribute':    'msRRASAttribute',
            'ms-RRAS-Vendor-Attribute-Entry':   'msRRASVendorAttributeEntry',
            'ms-SPP-CSVLK-Partial-Product-Key': 'msSPP-CSVLKPartialProductKey',
            'ms-SPP-CSVLK-Pid': 'msSPP-CSVLKPid',
            'ms-SPP-CSVLK-Sku-Id':  'msSPP-CSVLKSkuId',
            'ms-SPP-Config-License':    'msSPP-ConfigLicense',
            'ms-SPP-Confirmation-Id':   'msSPP-ConfirmationId',
            'ms-SPP-Installation-Id':   'msSPP-InstallationId',
            'ms-SPP-Issuance-License':  'msSPP-IssuanceLicense',
            'ms-SPP-KMS-Ids':   'msSPP-KMSIds',
            'ms-SPP-Online-License':    'msSPP-OnlineLicense',
            'ms-SPP-Phone-License': 'msSPP-PhoneLicense',
            'ms-TAPI-Conference-Blob':  'msTAPI-ConferenceBlob',
            'ms-TAPI-Ip-Address':   'msTAPI-IpAddress',
            'ms-TAPI-Protocol-Id':  'msTAPI-ProtocolId',
            'ms-TAPI-Unique-Identifier':    'msTAPI-uid',
            'ms-TPM-Owner-Information-Temp':    'msTPM-OwnerInformationTemp',
            'ms-TPM-OwnerInformation':  'msTPM-OwnerInformation',
            'ms-TPM-Srk-Pub-Thumbprint':    'msTPM-SrkPubThumbprint',
            'ms-TPM-Tpm-Information-For-Computer':  'msTPM-TpmInformationForComputer',
            'ms-TPM-Tpm-Information-For-Computer-BL':   'msTPM-TpmInformationForComputerBL',
            'ms-TS-Allow-Logon':    'msTSAllowLogon',
            'ms-TS-Broken-Connection-Action':   'msTSBrokenConnectionAction',
            'ms-TS-Connect-Client-Drives':  'msTSConnectClientDrives',
            'ms-TS-Connect-Printer-Drives': 'msTSConnectPrinterDrives',
            'ms-TS-Default-To-Main-Printer':    'msTSDefaultToMainPrinter',
            'ms-TS-Endpoint-Data':  'msTSEndpointData',
            'ms-TS-Endpoint-Plugin':    'msTSEndpointPlugin',
            'ms-TS-Endpoint-Type':  'msTSEndpointType',
            'ms-TS-Home-Directory': 'msTSHomeDirectory',
            'ms-TS-Home-Drive': 'msTSHomeDrive',
            'ms-TS-Initial-Program':    'msTSInitialProgram',
            'ms-TS-Max-Connection-Time':    'msTSMaxConnectionTime',
            'ms-TS-Max-Disconnection-Time': 'msTSMaxDisconnectionTime',
            'ms-TS-Max-Idle-Time':  'msTSMaxIdleTime',
            'ms-TS-Primary-Desktop':    'msTSPrimaryDesktop',
            'ms-TS-Primary-Desktop-BL': 'msTSPrimaryDesktopBL',
            'ms-TS-Profile-Path':   'msTSProfilePath',
            'ms-TS-Reconnection-Action':    'msTSReconnectionAction',
            'ms-TS-Remote-Control': 'msTSRemoteControl',
            'ms-TS-Secondary-Desktop-BL':   'msTSSecondaryDesktopBL',
            'ms-TS-Secondary-Desktops': 'msTSSecondaryDesktops',
            'ms-TS-Work-Directory': 'msTSWorkDirectory',
            'ms-WMI-Author':    'msWMI-Author',
            'ms-WMI-ChangeDate':    'msWMI-ChangeDate',
            'ms-WMI-Class': 'msWMI-Class',
            'ms-WMI-ClassDefinition':   'msWMI-ClassDefinition',
            'ms-WMI-CreationDate':  'msWMI-CreationDate',
            'ms-WMI-Genus': 'msWMI-Genus',
            'ms-WMI-ID':    'msWMI-ID',
            'ms-WMI-Mof':   'msWMI-Mof',
            'ms-WMI-Name':  'msWMI-Name',
            'ms-WMI-NormalizedClass':   'msWMI-NormalizedClass',
            'ms-WMI-Parm1': 'msWMI-Parm1',
            'ms-WMI-Parm2': 'msWMI-Parm2',
            'ms-WMI-Parm3': 'msWMI-Parm3',
            'ms-WMI-Parm4': 'msWMI-Parm4',
            'ms-WMI-PropertyName':  'msWMI-PropertyName',
            'ms-WMI-Query': 'msWMI-Query',
            'ms-WMI-QueryLanguage': 'msWMI-QueryLanguage',
            'ms-WMI-ScopeGuid': 'msWMI-ScopeGuid',
            'ms-WMI-SourceOrganization':    'msWMI-SourceOrganization',
            'ms-WMI-TargetClass':   'msWMI-TargetClass',
            'ms-WMI-TargetNameSpace':   'msWMI-TargetNameSpace',
            'ms-WMI-TargetObject':  'msWMI-TargetObject',
            'ms-WMI-TargetPath':    'msWMI-TargetPath',
            'ms-WMI-TargetType':    'msWMI-TargetType',
            'ms-WMI-int8Default':   'msWMI-Int8Default',
            'ms-WMI-int8Max':   'msWMI-Int8Max',
            'ms-WMI-int8Min':   'msWMI-Int8Min',
            'ms-WMI-int8ValidValues':   'msWMI-Int8ValidValues',
            'ms-WMI-intDefault':    'msWMI-IntDefault',
            'ms-WMI-intFlags1': 'msWMI-intFlags1',
            'ms-WMI-intFlags2': 'msWMI-intFlags2',
            'ms-WMI-intFlags3': 'msWMI-intFlags3',
            'ms-WMI-intFlags4': 'msWMI-intFlags4',
            'ms-WMI-intMax':    'msWMI-IntMax',
            'ms-WMI-intMin':    'msWMI-IntMin',
            'ms-WMI-intValidValues':    'msWMI-IntValidValues',
            'ms-WMI-stringDefault': 'msWMI-StringDefault',
            'ms-WMI-stringValidValues': 'msWMI-StringValidValues',
            'ms-ds-Schema-Extensions':  'msDs-Schema-Extensions',
            'ms-ieee-80211-Data':   'msieee80211-Data',
            'ms-ieee-80211-Data-Type':  'msieee80211-DataType',
            'ms-ieee-80211-ID': 'msieee80211-ID',
            'ms-net-ieee-80211-GP-PolicyData':  'ms-net-ieee-80211-GP-PolicyData',
            'ms-net-ieee-80211-GP-PolicyGUID':  'ms-net-ieee-80211-GP-PolicyGUID',
            'ms-net-ieee-80211-GP-PolicyReserved':  'ms-net-ieee-80211-GP-PolicyReserved',
            'ms-net-ieee-8023-GP-PolicyData':   'ms-net-ieee-8023-GP-PolicyData',
            'ms-net-ieee-8023-GP-PolicyGUID':   'ms-net-ieee-8023-GP-PolicyGUID',
            'ms-net-ieee-8023-GP-PolicyReserved':   'ms-net-ieee-8023-GP-PolicyReserved',
            'msNPAllowDialin':  'msNPAllowDialin',
            'msNPCalledStationID':  'msNPCalledStationID',
            'msNPCallingStationID': 'msNPCallingStationID',
            'msNPSavedCallingStationID':    'msNPSavedCallingStationID',
            'msRADIUSCallbackNumber':   'msRADIUSCallbackNumber',
            'msRADIUSFramedIPAddress':  'msRADIUSFramedIPAddress',
            'msRADIUSFramedRoute':  'msRADIUSFramedRoute',
            'msRADIUSServiceType':  'msRADIUSServiceType',
            'msRASSavedCallbackNumber': 'msRASSavedCallbackNumber',
            'msRASSavedFramedIPAddress':    'msRASSavedFramedIPAddress',
            'msRASSavedFramedRoute':    'msRASSavedFramedRoute',
            'msSFU-30-Aliases': 'msSFU30Aliases',
            'msSFU-30-Crypt-Method':    'msSFU30CryptMethod',
            'msSFU-30-Domains': 'msSFU30Domains',
            'msSFU-30-Field-Separator': 'msSFU30FieldSeparator',
            'msSFU-30-Intra-Field-Separator':   'msSFU30IntraFieldSeparator',
            'msSFU-30-Is-Valid-Container':  'msSFU30IsValidContainer',
            'msSFU-30-Key-Attributes':  'msSFU30KeyAttributes',
            'msSFU-30-Key-Values':  'msSFU30KeyValues',
            'msSFU-30-Map-Filter':  'msSFU30MapFilter',
            'msSFU-30-Master-Server-Name':  'msSFU30MasterServerName',
            'msSFU-30-Max-Gid-Number':  'msSFU30MaxGidNumber',
            'msSFU-30-Max-Uid-Number':  'msSFU30MaxUidNumber',
            'msSFU-30-NSMAP-Field-Position':    'msSFU30NSMAPFieldPosition',
            'msSFU-30-Name':    'msSFU30Name',
            'msSFU-30-Netgroup-Host-At-Domain': 'msSFU30NetgroupHostAtDomain',
            'msSFU-30-Netgroup-User-At-Domain': 'msSFU30NetgroupUserAtDomain',
            'msSFU-30-Nis-Domain':  'msSFU30NisDomain',
            'msSFU-30-Order-Number':    'msSFU30OrderNumber',
            'msSFU-30-Posix-Member':    'msSFU30PosixMember',
            'msSFU-30-Posix-Member-Of': 'msSFU30PosixMemberOf',
            'msSFU-30-Result-Attributes':   'msSFU30ResultAttributes',
            'msSFU-30-Search-Attributes':   'msSFU30SearchAttributes',
            'msSFU-30-Search-Container':    'msSFU30SearchContainer',
            'msSFU-30-Yp-Servers':  'msSFU30YpServers',
            'netboot-Allow-New-Clients':    'netbootAllowNewClients',
            'netboot-Answer-Only-Valid-Clients':    'netbootAnswerOnlyValidClients',
            'netboot-Answer-Requests':  'netbootAnswerRequests',
            'netboot-Current-Client-Count': 'netbootCurrentClientCount',
            'netboot-IntelliMirror-OSes':   'netbootIntelliMirrorOSes',
            'netboot-Limit-Clients':    'netbootLimitClients',
            'netboot-Locally-Installed-OSes':   'netbootLocallyInstalledOSes',
            'netboot-Max-Clients':  'netbootMaxClients',
            'netboot-New-Machine-Naming-Policy':    'netbootNewMachineNamingPolicy',
            'netboot-New-Machine-OU':   'netbootNewMachineOU',
            'netboot-SCP-BL':   'netbootSCPBL',
            'netboot-Server':   'netbootServer',
            'netboot-Tools':    'netbootTools',
            'nisMapEntry':  'nisMapEntry',
            'nisMapName':   'nisMapName',
            'nisNetgroupTriple':    'nisNetgroupTriple',
            'oncRpcNumber': 'oncRpcNumber',
            'organizationalStatus': 'organizationalStatus',
            'photo':    'photo',
            'preferredLanguage':    'preferredLanguage',
            'roomNumber':   'roomNumber',
            'rpc-Ns-Annotation':    'rpcNsAnnotation',
            'rpc-Ns-Bindings':  'rpcNsBindings',
            'rpc-Ns-Codeset':   'rpcNsCodeset',
            'rpc-Ns-Entry-Flags':   'rpcNsEntryFlags',
            'rpc-Ns-Group': 'rpcNsGroup',
            'rpc-Ns-Interface-ID':  'rpcNsInterfaceID',
            'rpc-Ns-Object-ID': 'rpcNsObjectID',
            'rpc-Ns-Priority':  'rpcNsPriority',
            'rpc-Ns-Profile-Entry': 'rpcNsProfileEntry',
            'rpc-Ns-Transfer-Syntax':   'rpcNsTransferSyntax',
            'secretary':    'secretary',
            'shadowExpire': 'shadowExpire',
            'shadowFlag':   'shadowFlag',
            'shadowInactive':   'shadowInactive',
            'shadowLastChange': 'shadowLastChange',
            'shadowMax':    'shadowMax',
            'shadowMin':    'shadowMin',
            'shadowWarning':    'shadowWarning',
            'uid':  'uid',
            'uidNumber':    'uidNumber',
            'uniqueIdentifier': 'uniqueIdentifier',
            'uniqueMember': 'uniqueMember',
            'unixHomeDirectory':    'unixHomeDirectory',
            'unixUserPassword': 'unixUserPassword',
            'unstructuredAddress':  'unstructuredAddress',
            'unstructuredName': 'unstructuredName',
            'userClass':    'userClass',
            'userPKCS12':   'userPKCS12',
            'x500uniqueIdentifier': 'x500uniqueIdentifier'
        },
        
        /**
         * Knowledge for the Active Directory Schema - Classes
         * 
         * See http://msdn.microsoft.com/en-us/library/windows/desktop/ms680938%28v=vs.85%29.aspx
         * 
         * Each class has a set of direct attributes and a set of auxiliary classes.  Thus the
         * class will look like this:
         * 
         * 'User': {
         *      'ldapname':   'user',
         *      'attributes': [ 'Common-Name', 'Given-Name', 'Surname' ],
         *      'classes'     [ 'Security-Principal', 'Mail-Recipient' ]
         *  },
         *  
         *  We will add auxiliary classes to the list of object classes to display, then display the
         *  attributes (which are in CN form, not LDAP form).
         *  
         *  The content is generated by get-ad-classes.pl from the MSDN website
         */
        adSchemaClasses: {
            'ms-DS-Claim-Type-Property-Base': {
                  'classes': [],
                  'ldapname': 'msDS-ClaimTypePropertyBase',
                  'attributes': [
                                    'Enabled',
                                    'ms-DS-Claim-Possible-Values',
                                    'ms-DS-Claim-Shares-Possible-Values-With'
                                  ]
                },
            'ms-DS-Claims-Transformation-Policies': {
                  'classes': [],
                  'ldapname': 'msDS-ClaimsTransformationPolicies',
                  'attributes': []
                },
            'MSMQ-Configuration': {
                  'classes': [],
                  'ldapname': 'mSMQConfiguration',
                  'attributes': [
                                    'MSMQ-Computer-Type',
                                    'MSMQ-Computer-Type-Ex',
                                    'MSMQ-Dependent-Client-Services',
                                    'MSMQ-Ds-Services',
                                    'MSMQ-Encrypt-Key',
                                    'MSMQ-Foreign',
                                    'MSMQ-In-Routing-Servers',
                                    'MSMQ-Journal-Quota',
                                    'MSMQ-OS-Type',
                                    'MSMQ-Out-Routing-Servers',
                                    'MSMQ-Owner-ID',
                                    'MSMQ-Quota',
                                    'MSMQ-Routing-Services',
                                    'MSMQ-Service-Type',
                                    'MSMQ-Sign-Key',
                                    'MSMQ-Sites'
                                  ]
                },
            'Com-Connection-Point': {
                  'classes': [],
                  'ldapname': 'comConnectionPoint',
                  'attributes': [
                                    'Common-Name',
                                    'Marshalled-Interface',
                                    'Moniker',
                                    'Moniker-Display-Name'
                                  ]
                },
            'ms-DFSR-Content': {
                  'classes': [],
                  'ldapname': 'msDFSR-Content',
                  'attributes': [
                                    'ms-DFSR-Extension',
                                    'ms-DFSR-Flags',
                                    'ms-DFSR-Options',
                                    'ms-DFSR-Options2'
                                  ]
                },
            'rpc-Server': {
                  'classes': [],
                  'ldapname': 'rpcServer',
                  'attributes': [
                                    'rpc-Ns-Codeset',
                                    'rpc-Ns-Entry-Flags',
                                    'rpc-Ns-Object-ID'
                                  ]
                },
            'ms-TPM-Information-Object': {
                  'classes': [],
                  'ldapname': 'msTPM-InformationObject',
                  'attributes': [
                                    'ms-TPM-Owner-Information-Temp',
                                    'ms-TPM-OwnerInformation',
                                    'ms-TPM-Srk-Pub-Thumbprint'
                                  ]
                },
            'MS-SQL-SQLRepository': {
                  'classes': [],
                  'ldapname': 'mS-SQL-SQLRepository',
                  'attributes': [
                                    'MS-SQL-Build',
                                    'MS-SQL-Contact',
                                    'MS-SQL-Description',
                                    'MS-SQL-InformationDirectory',
                                    'MS-SQL-Name',
                                    'MS-SQL-Status',
                                    'MS-SQL-Version'
                                  ]
                },
            'ms-DNS-Server-Settings': {
                  'classes': [],
                  'ldapname': 'msDNS-ServerSettings',
                  'attributes': [
                                    'ms-DNS-Keymaster-Zones'
                                  ]
                },
            'MSMQ-Site-Link': {
                  'classes': [],
                  'ldapname': 'mSMQSiteLink',
                  'attributes': [
                                    'MSMQ-Cost',
                                    'MSMQ-Site-1',
                                    'MSMQ-Site-2',
                                    'MSMQ-Site-Gates',
                                    'MSMQ-Site-Gates-Mig'
                                  ]
                },
            'Locality': {
                  'classes': [],
                  'ldapname': 'locality',
                  'attributes': [
                                    'Locality-Name',
                                    'Organization',
                                    'Search-Guide',
                                    'See-Also',
                                    'State-Or-Province-Name',
                                    'Street-Address'
                                  ]
                },
            'NTFRS-Replica-Set': {
                  'classes': [],
                  'ldapname': 'nTFRSReplicaSet',
                  'attributes': [
                                    'FRS-DS-Poll',
                                    'FRS-Directory-Filter',
                                    'FRS-Extensions',
                                    'FRS-File-Filter',
                                    'FRS-Flags',
                                    'FRS-Level-Limit',
                                    'FRS-Partner-Auth-Level',
                                    'FRS-Primary-Member',
                                    'FRS-Replica-Set-GUID',
                                    'FRS-Replica-Set-Type',
                                    'FRS-Root-Security',
                                    'FRS-Service-Command',
                                    'FRS-Version-GUID',
                                    'Managed-By',
                                    'Schedule',
                                    'ms-FRS-Hub-Member',
                                    'ms-FRS-Topology-Pref'
                                  ]
                },
            'ms-WMI-UnknownRangeParam': {
                  'classes': [],
                  'ldapname': 'msWMI-UnknownRangeParam',
                  'attributes': [
                                    'ms-WMI-NormalizedClass',
                                    'ms-WMI-TargetObject'
                                  ]
                },
            'PKI-Enrollment-Service': {
                  'classes': [],
                  'ldapname': 'pKIEnrollmentService',
                  'attributes': [
                                    'CA-Certificate',
                                    'CA-Certificate-DN',
                                    'Certificate-Templates',
                                    'DNS-Host-Name',
                                    'Enrollment-Providers',
                                    'Signature-Algorithms',
                                    'ms-PKI-Enrollment-Servers',
                                    'ms-PKI-Site-Name'
                                  ]
                },
            'rpc-Entry': {
                  'classes': [],
                  'ldapname': 'rpcEntry',
                  'attributes': []
                },
            'Top': {
                  'classes': [],
                  'ldapname': 'top',
                  'attributes': [
                                    '',
                                    'Admin-Description',
                                    'Admin-Display-Name',
                                    'Allowed-Attributes',
                                    'Allowed-Attributes-Effective',
                                    'Allowed-Child-Classes',
                                    'Allowed-Child-Classes-Effective',
                                    'Bridgehead-Server-List-BL',
                                    'Canonical-Name',
                                    'Common-Name',
                                    'Create-Time-Stamp',
                                    'DS-Core-Propagation-Data',
                                    'DSA-Signature',
                                    'Description',
                                    'Display-Name',
                                    'Display-Name-Printable',
                                    'Extension-Name',
                                    'FRS-Member-Reference-BL',
                                    'FSMO-Role-Owner',
                                    'Flags',
                                    'From-Entry',
                                    'Frs-Computer-Reference-BL',
                                    'Instance-Type',
                                    'Is-Critical-System-Object',
                                    'Is-Deleted',
                                    'Is-Member-Of-DL',
                                    'Is-Privilege-Holder',
                                    'Is-Recycled',
                                    'Last-Known-Parent',
                                    'MS-DS-Consistency-Child-Count',
                                    'MS-DS-Consistency-Guid',
                                    'Managed-Objects',
                                    'Mastered-By',
                                    'Modify-Time-Stamp',
                                    'NT-Security-Descriptor',
                                    'Non-Security-Member-BL',
                                    'Obj-Dist-Name',
                                    'Object-Category',
                                    'Object-Class',
                                    'Object-Guid',
                                    'Object-Version',
                                    'Other-Well-Known-Objects',
                                    'Partial-Attribute-Deletion-List',
                                    'Partial-Attribute-Set',
                                    'Possible-Inferiors',
                                    'Proxied-Object-Name',
                                    'Proxy-Addresses',
                                    'Query-Policy-BL',
                                    'RDN',
                                    'Repl-Property-Meta-Data',
                                    'Repl-UpToDate-Vector',
                                    'Reports',
                                    'Reps-From',
                                    'Reps-To',
                                    'Revision',
                                    'SD-Rights-Effective',
                                    'Server-Reference-BL',
                                    'Show-In-Advanced-View-Only',
                                    'Site-Object-BL',
                                    'Structural-Object-Class',
                                    'Sub-Refs',
                                    'SubSchemaSubEntry',
                                    'System-Flags',
                                    'USN-Changed',
                                    'USN-Created',
                                    'USN-DSA-Last-Obj-Removed',
                                    'USN-Intersite',
                                    'USN-Last-Obj-Rem',
                                    'USN-Source',
                                    'WWW-Home-Page',
                                    'WWW-Page-Other',
                                    'Wbem-Path',
                                    'Well-Known-Objects',
                                    'When-Changed',
                                    'When-Created',
                                    'ms-COM-PartitionSetLink',
                                    'ms-COM-UserLink',
                                    'ms-DFSR-ComputerReferenceBL',
                                    'ms-DFSR-MemberReferenceBL',
                                    'ms-DS-Approx-Immed-Subordinates',
                                    'ms-DS-AuthenticatedTo-Accountlist',
                                    'ms-DS-Claim-Shares-Possible-Values-With-BL',
                                    'ms-DS-Disable-For-Instances-BL',
                                    'ms-DS-Enabled-Feature-BL',
                                    'ms-DS-Host-Service-Account-BL',
                                    'ms-DS-Is-Domain-For',
                                    'ms-DS-Is-Full-Replica-For',
                                    'ms-DS-Is-Partial-Replica-For',
                                    'ms-DS-Is-Primary-Computer-For',
                                    'ms-DS-KrbTgt-Link-BL',
                                    'ms-DS-Last-Known-RDN',
                                    'ms-DS-Mastered-By',
                                    'ms-DS-Members-For-Az-Role-BL',
                                    'ms-DS-Members-Of-Resource-Property-List-BL',
                                    'ms-DS-NC-RO-Replica-Locations-BL',
                                    'ms-DS-NC-Repl-Cursors',
                                    'ms-DS-NC-Repl-Inbound-Neighbors',
                                    'ms-DS-NC-Repl-Outbound-Neighbors',
                                    'ms-DS-NC-Type',
                                    'ms-DS-Non-Members-BL',
                                    'ms-DS-OIDToGroup-Link-BL',
                                    'ms-DS-Object-Reference-BL',
                                    'ms-DS-Operations-For-Az-Role-BL',
                                    'ms-DS-Operations-For-Az-Task-BL',
                                    'ms-DS-PSO-Applied',
                                    'ms-DS-Principal-Name',
                                    'ms-DS-Repl-Attribute-Meta-Data',
                                    'ms-DS-Repl-Value-Meta-Data',
                                    'ms-DS-Revealed-DSAs',
                                    'ms-DS-Revealed-List-BL',
                                    'ms-DS-Service-Account-BL',
                                    'ms-DS-TDO-Egress-BL',
                                    'ms-DS-TDO-Ingress-BL',
                                    'ms-DS-Tasks-For-Az-Role-BL',
                                    'ms-DS-Tasks-For-Az-Task-BL',
                                    'ms-DS-Value-Type-Reference-BL',
                                    'ms-DS-local-Effective-Deletion-Time',
                                    'ms-DS-local-Effective-Recycle-Time',
                                    'ms-Exch-Owner-BL',
                                    'msSFU-30-Posix-Member-Of',
                                    'netboot-SCP-BL'
                                  ]
                },
            'ms-DS-Resource-Property': {
                  'classes': [],
                  'ldapname': 'msDS-ResourceProperty',
                  'attributes': [
                                    'ms-DS-Applies-To-Resource-Types',
                                    'ms-DS-Is-Used-As-Resource-Security-Attribute',
                                    'ms-DS-Value-Type-Reference'
                                  ]
                },
            'ms-DFSR-Subscription': {
                  'classes': [],
                  'ldapname': 'msDFSR-Subscription',
                  'attributes': [
                                    'ms-DFSR-CachePolicy',
                                    'ms-DFSR-ConflictPath',
                                    'ms-DFSR-ConflictSizeInMb',
                                    'ms-DFSR-ContentSetGuid',
                                    'ms-DFSR-DeletedPath',
                                    'ms-DFSR-DeletedSizeInMb',
                                    'ms-DFSR-DfsLinkTarget',
                                    'ms-DFSR-Enabled',
                                    'ms-DFSR-Extension',
                                    'ms-DFSR-Flags',
                                    'ms-DFSR-MaxAgeInCacheInMin',
                                    'ms-DFSR-MinDurationCacheInMin',
                                    'ms-DFSR-OnDemandExclusionDirectoryFilter',
                                    'ms-DFSR-OnDemandExclusionFileFilter',
                                    'ms-DFSR-Options',
                                    'ms-DFSR-Options2',
                                    'ms-DFSR-ReadOnly',
                                    'ms-DFSR-ReplicationGroupGuid',
                                    'ms-DFSR-RootFence',
                                    'ms-DFSR-RootPath',
                                    'ms-DFSR-RootSizeInMb',
                                    'ms-DFSR-StagingCleanupTriggerInPercent',
                                    'ms-DFSR-StagingPath',
                                    'ms-DFSR-StagingSizeInMb'
                                  ]
                },
            'ieee802Device': {
                  'classes': [],
                  'ldapname': 'ieee802Device',
                  'attributes': [
                                    'Common-Name',
                                    'macAddress'
                                  ]
                },
            'ms-DFS-Namespace-v2': {
                  'classes': [],
                  'ldapname': 'msDFS-Namespacev2',
                  'attributes': [
                                    'ms-DFS-Comment-v2',
                                    'ms-DFS-Generation-GUID-v2',
                                    'ms-DFS-Last-Modified-v2',
                                    'ms-DFS-Namespace-Identity-GUID-v2',
                                    'ms-DFS-Properties-v2',
                                    'ms-DFS-Schema-Major-Version',
                                    'ms-DFS-Schema-Minor-Version',
                                    'ms-DFS-Target-List-v2',
                                    'ms-DFS-Ttl-v2'
                                  ]
                },
            'MS-SQL-SQLServer': {
                  'classes': [],
                  'ldapname': 'mS-SQL-SQLServer',
                  'attributes': [
                                    'MS-SQL-AppleTalk',
                                    'MS-SQL-Build',
                                    'MS-SQL-CharacterSet',
                                    'MS-SQL-Clustered',
                                    'MS-SQL-Contact',
                                    'MS-SQL-GPSHeight',
                                    'MS-SQL-GPSLatitude',
                                    'MS-SQL-GPSLongitude',
                                    'MS-SQL-InformationURL',
                                    'MS-SQL-Keywords',
                                    'MS-SQL-LastUpdatedDate',
                                    'MS-SQL-Location',
                                    'MS-SQL-Memory',
                                    'MS-SQL-MultiProtocol',
                                    'MS-SQL-Name',
                                    'MS-SQL-NamedPipe',
                                    'MS-SQL-RegisteredOwner',
                                    'MS-SQL-SPX',
                                    'MS-SQL-ServiceAccount',
                                    'MS-SQL-SortOrder',
                                    'MS-SQL-Status',
                                    'MS-SQL-TCPIP',
                                    'MS-SQL-UnicodeSortOrder',
                                    'MS-SQL-Vines'
                                  ]
                },
            'rpc-Group': {
                  'classes': [],
                  'ldapname': 'rpcGroup',
                  'attributes': [
                                    'rpc-Ns-Group',
                                    'rpc-Ns-Object-ID'
                                  ]
                },
            'ms-TAPI-Rt-Conference': {
                  'classes': [],
                  'ldapname': 'msTAPI-RtConference',
                  'attributes': [
                                    'ms-TAPI-Conference-Blob',
                                    'ms-TAPI-Protocol-Id',
                                    'ms-TAPI-Unique-Identifier'
                                  ]
                },
            'Intellimirror-Group': {
                  'classes': [],
                  'ldapname': 'intellimirrorGroup',
                  'attributes': []
                },
            'Link-Track-Object-Move-Table': {
                  'classes': [],
                  'ldapname': 'linkTrackObjectMoveTable',
                  'attributes': []
                },
            'ms-DS-Quota-Container': {
                  'classes': [],
                  'ldapname': 'msDS-QuotaContainer',
                  'attributes': [
                                    'Common-Name',
                                    'ms-DS-Default-Quota',
                                    'ms-DS-Quota-Effective',
                                    'ms-DS-Quota-Used',
                                    'ms-DS-Tombstone-Quota-Factor',
                                    'ms-DS-Top-Quota-Usage'
                                  ]
                },
            'Print-Queue': {
                  'classes': [],
                  'ldapname': 'printQueue',
                  'attributes': [
                                    'Asset-Number',
                                    'Bytes-Per-Minute',
                                    'Default-Priority',
                                    'Driver-Name',
                                    'Driver-Version',
                                    'Location',
                                    'Operating-System',
                                    'Operating-System-Hotfix',
                                    'Operating-System-Service-Pack',
                                    'Operating-System-Version',
                                    'Physical-Location-Object',
                                    'Port-Name',
                                    'Print-Attributes',
                                    'Print-Bin-Names',
                                    'Print-Collate',
                                    'Print-Color',
                                    'Print-Duplex-Supported',
                                    'Print-End-Time',
                                    'Print-Form-Name',
                                    'Print-Keep-Printed-Jobs',
                                    'Print-Language',
                                    'Print-MAC-Address',
                                    'Print-Max-Copies',
                                    'Print-Max-Resolution-Supported',
                                    'Print-Max-X-Extent',
                                    'Print-Max-Y-Extent',
                                    'Print-Media-Ready',
                                    'Print-Media-Supported',
                                    'Print-Memory',
                                    'Print-Min-X-Extent',
                                    'Print-Min-Y-Extent',
                                    'Print-Network-Address',
                                    'Print-Notify',
                                    'Print-Number-Up',
                                    'Print-Orientations-Supported',
                                    'Print-Owner',
                                    'Print-Pages-Per-Minute',
                                    'Print-Rate',
                                    'Print-Rate-Unit',
                                    'Print-Separator-File',
                                    'Print-Share-Name',
                                    'Print-Spooling',
                                    'Print-Stapling-Supported',
                                    'Print-Start-Time',
                                    'Print-Status',
                                    'Printer-Name',
                                    'Priority',
                                    'Server-Name',
                                    'Short-Server-Name',
                                    'UNC-Name',
                                    'Version-Number'
                                  ]
                },
            'ms-COM-Partition': {
                  'classes': [],
                  'ldapname': 'msCOM-Partition',
                  'attributes': [
                                    'ms-COM-ObjectId'
                                  ]
                },
            'Mail-Recipient': {
                  'classes': [],
                  'ldapname': 'mailRecipient',
                  'attributes': [
                                    'Comment',
                                    'Common-Name',
                                    'Garbage-Coll-Period',
                                    'Legacy-Exchange-DN',
                                    'Show-In-Address-Book',
                                    'Telephone-Number',
                                    'Text-Encoded-OR-Address',
                                    'User-Cert',
                                    'User-SMIME-Certificate',
                                    'X509-Cert',
                                    'labeledURI',
                                    'ms-DS-GeoCoordinates-Altitude',
                                    'ms-DS-GeoCoordinates-Latitude',
                                    'ms-DS-GeoCoordinates-Longitude',
                                    'ms-DS-Phonetic-Display-Name',
                                    'ms-Exch-Assistant-Name',
                                    'ms-Exch-LabeledURI',
                                    'secretary'
                                  ]
                },
            'Organizational-Role': {
                  'classes': [],
                  'ldapname': 'organizationalRole',
                  'attributes': [
                                    'Common-Name',
                                    'Destination-Indicator',
                                    'Facsimile-Telephone-Number',
                                    'International-ISDN-Number',
                                    'Locality-Name',
                                    'Organizational-Unit-Name',
                                    'Physical-Delivery-Office-Name',
                                    'Post-Office-Box',
                                    'Postal-Address',
                                    'Postal-Code',
                                    'Preferred-Delivery-Method',
                                    'Registered-Address',
                                    'Role-Occupant',
                                    'See-Also',
                                    'State-Or-Province-Name',
                                    'Street-Address',
                                    'Telephone-Number',
                                    'Teletex-Terminal-Identifier',
                                    'Telex-Number',
                                    'X121-Address'
                                  ]
                },
            'ms-DFSR-ContentSet': {
                  'classes': [],
                  'ldapname': 'msDFSR-ContentSet',
                  'attributes': [
                                    'Description',
                                    'ms-DFSR-ConflictSizeInMb',
                                    'ms-DFSR-DefaultCompressionExclusionFilter',
                                    'ms-DFSR-DeletedSizeInMb',
                                    'ms-DFSR-DfsPath',
                                    'ms-DFSR-DirectoryFilter',
                                    'ms-DFSR-Extension',
                                    'ms-DFSR-FileFilter',
                                    'ms-DFSR-Flags',
                                    'ms-DFSR-OnDemandExclusionDirectoryFilter',
                                    'ms-DFSR-OnDemandExclusionFileFilter',
                                    'ms-DFSR-Options',
                                    'ms-DFSR-Options2',
                                    'ms-DFSR-Priority',
                                    'ms-DFSR-RootSizeInMb',
                                    'ms-DFSR-StagingSizeInMb'
                                  ]
                },
            'ms-FVE-RecoveryInformation': {
                  'classes': [],
                  'ldapname': 'msFVE-RecoveryInformation',
                  'attributes': [
                                    'ms-FVE-KeyPackage',
                                    'ms-FVE-RecoveryGuid',
                                    'ms-FVE-RecoveryPassword',
                                    'ms-FVE-VolumeGuid'
                                  ]
                },
            'Dynamic-Object': {
                  'classes': [],
                  'ldapname': 'dynamicObject',
                  'attributes': [
                                    'Entry-TTL',
                                    'ms-DS-Entry-Time-To-Die'
                                  ]
                },
            'Sam-Server': {
                  'classes': [],
                  'ldapname': 'samServer',
                  'attributes': [
                                    'SAM-Domain-Updates'
                                  ]
                },
            'ms-net-ieee-80211-GroupPolicy': {
                  'classes': [],
                  'ldapname': 'ms-net-ieee-80211-GroupPolicy',
                  'attributes': [
                                    'ms-net-ieee-80211-GP-PolicyData',
                                    'ms-net-ieee-80211-GP-PolicyGUID',
                                    'ms-net-ieee-80211-GP-PolicyReserved'
                                  ]
                },
            'NTFRS-Settings': {
                  'classes': [],
                  'ldapname': 'nTFRSSettings',
                  'attributes': [
                                    'FRS-Extensions',
                                    'Managed-By',
                                    'Organization'
                                  ]
                },
            'FT-Dfs': {
                  'classes': [],
                  'ldapname': 'fTDfs',
                  'attributes': [
                                    'Keywords',
                                    'Managed-By',
                                    'PKT',
                                    'PKT-Guid',
                                    'Remote-Server-Name',
                                    'UNC-Name'
                                  ]
                },
            'Type-Library': {
                  'classes': [],
                  'ldapname': 'typeLibrary',
                  'attributes': [
                                    'COM-ClassID',
                                    'COM-InterfaceID',
                                    'COM-Unique-LIBID'
                                  ]
                },
            'CRL-Distribution-Point': {
                  'classes': [],
                  'ldapname': 'cRLDistributionPoint',
                  'attributes': [
                                    'Authority-Revocation-List',
                                    'CRL-Partitioned-Revocation-List',
                                    'Certificate-Authority-Object',
                                    'Certificate-Revocation-List',
                                    'Common-Name',
                                    'Delta-Revocation-List'
                                  ]
                },
            'Inter-Site-Transport': {
                  'classes': [],
                  'ldapname': 'interSiteTransport',
                  'attributes': [
                                    'Options',
                                    'Repl-Interval',
                                    'Transport-Address-Attribute',
                                    'Transport-DLL-Name'
                                  ]
                },
            'Storage': {
                  'classes': [],
                  'ldapname': 'storage',
                  'attributes': [
                                    'Icon-Path',
                                    'Moniker',
                                    'Moniker-Display-Name'
                                  ]
                },
            'NTDS-Connection': {
                  'classes': [],
                  'ldapname': 'nTDSConnection',
                  'attributes': [
                                    'Enabled-Connection',
                                    'From-Server',
                                    'Generated-Connection',
                                    'MS-DS-Replicates-NC-Reason',
                                    'Options',
                                    'Schedule',
                                    'Transport-Type'
                                  ]
                },
            'Cross-Ref-Container': {
                  'classes': [],
                  'ldapname': 'crossRefContainer',
                  'attributes': [
                                    'UPN-Suffixes',
                                    'ms-DS-Behavior-Version',
                                    'ms-DS-Enabled-Feature',
                                    'ms-DS-ExecuteScriptPassword',
                                    'ms-DS-SPN-Suffixes',
                                    'ms-DS-UpdateScript'
                                  ]
                },
            'ms-Authz-Central-Access-Policies': {
                  'classes': [],
                  'ldapname': 'msAuthz-CentralAccessPolicies',
                  'attributes': []
                },
            'Security-Principal': {
                  'classes': [],
                  'ldapname': 'securityPrincipal',
                  'attributes': [
                                    'Account-Name-History',
                                    'Alt-Security-Identities',
                                    'NT-Security-Descriptor',
                                    'Object-Sid',
                                    'Rid',
                                    'SAM-Account-Name',
                                    'SAM-Account-Type',
                                    'SID-History',
                                    'Security-Identifier',
                                    'Supplemental-Credentials',
                                    'Token-Groups',
                                    'Token-Groups-Global-And-Universal',
                                    'Token-Groups-No-GC-Acceptable',
                                    'ms-DS-KeyVersionNumber'
                                  ]
                },
            'ms-DFSR-Topology': {
                  'classes': [],
                  'ldapname': 'msDFSR-Topology',
                  'attributes': [
                                    'ms-DFSR-Extension',
                                    'ms-DFSR-Flags',
                                    'ms-DFSR-Options',
                                    'ms-DFSR-Options2'
                                  ]
                },
            'NTDS-Site-Settings': {
                  'classes': [],
                  'ldapname': 'nTDSSiteSettings',
                  'attributes': [
                                    'Inter-Site-Topology-Failover',
                                    'Inter-Site-Topology-Generator',
                                    'Inter-Site-Topology-Renew',
                                    'Managed-By',
                                    'Options',
                                    'Query-Policy-Object',
                                    'Schedule',
                                    'ms-DS-Preferred-GC-Site'
                                  ]
                },
            'Residential-Person': {
                  'classes': [],
                  'ldapname': 'residentialPerson',
                  'attributes': [
                                    'Business-Category',
                                    'Destination-Indicator',
                                    'Facsimile-Telephone-Number',
                                    'International-ISDN-Number',
                                    'Locality-Name',
                                    'Organizational-Unit-Name',
                                    'Physical-Delivery-Office-Name',
                                    'Post-Office-Box',
                                    'Postal-Address',
                                    'Postal-Code',
                                    'Preferred-Delivery-Method',
                                    'Registered-Address',
                                    'State-Or-Province-Name',
                                    'Street-Address',
                                    'Teletex-Terminal-Identifier',
                                    'Telex-Number',
                                    'Title',
                                    'X121-Address'
                                  ]
                },
            'Attribute-Schema': {
                  'classes': [],
                  'ldapname': 'attributeSchema',
                  'attributes': [
                                    'Attribute-ID',
                                    'Attribute-Security-GUID',
                                    'Attribute-Syntax',
                                    'Class-Display-Name',
                                    'Common-Name',
                                    'Extended-Chars-Allowed',
                                    'Is-Defunct',
                                    'Is-Ephemeral',
                                    'Is-Member-Of-Partial-Attribute-Set',
                                    'Is-Single-Valued',
                                    'LDAP-Display-Name',
                                    'Link-ID',
                                    'MAPI-ID',
                                    'OM-Object-Class',
                                    'OM-Syntax',
                                    'Range-Lower',
                                    'Range-Upper',
                                    'Schema-Flags-Ex',
                                    'Schema-ID-GUID',
                                    'Search-Flags',
                                    'System-Only',
                                    'ms-DS-IntId',
                                    'ms-ds-Schema-Extensions'
                                  ]
                },
            'Ipsec-Filter': {
                  'classes': [],
                  'ldapname': 'ipsecFilter',
                  'attributes': []
                },
            'Control-Access-Right': {
                  'classes': [],
                  'ldapname': 'controlAccessRight',
                  'attributes': [
                                    'Applies-To',
                                    'Localization-Display-Id',
                                    'Rights-Guid',
                                    'Valid-Accesses'
                                  ]
                },
            'Organizational-Unit': {
                  'classes': [],
                  'ldapname': 'organizationalUnit',
                  'attributes': [
                                    'Business-Category',
                                    'Country-Code',
                                    'Country-Name',
                                    'Default-Group',
                                    'Desktop-Profile',
                                    'Destination-Indicator',
                                    'Domain-DNS',
                                    'Facsimile-Telephone-Number',
                                    'GP-Link',
                                    'GP-Options',
                                    'International-ISDN-Number',
                                    'Locality-Name',
                                    'Logo',
                                    'Managed-By',
                                    'Organizational-Unit-Name',
                                    'Physical-Delivery-Office-Name',
                                    'Post-Office-Box',
                                    'Postal-Address',
                                    'Postal-Code',
                                    'Preferred-Delivery-Method',
                                    'Registered-Address',
                                    'Search-Guide',
                                    'See-Also',
                                    'State-Or-Province-Name',
                                    'Street-Address',
                                    'Telephone-Number',
                                    'Teletex-Terminal-Identifier',
                                    'Telex-Number',
                                    'Text-Country',
                                    'UPN-Suffixes',
                                    'User-Password',
                                    'X121-Address',
                                    'ms-COM-UserPartitionSetLink'
                                  ]
                },
            'msSFU-30-Domain-Info': {
                  'classes': [],
                  'ldapname': 'msSFU30DomainInfo',
                  'attributes': [
                                    'msSFU-30-Crypt-Method',
                                    'msSFU-30-Domains',
                                    'msSFU-30-Is-Valid-Container',
                                    'msSFU-30-Master-Server-Name',
                                    'msSFU-30-Max-Gid-Number',
                                    'msSFU-30-Max-Uid-Number',
                                    'msSFU-30-Order-Number',
                                    'msSFU-30-Search-Container',
                                    'msSFU-30-Yp-Servers'
                                  ]
                },
            'ACS-Resource-Limits': {
                  'classes': [],
                  'ldapname': 'aCSResourceLimits',
                  'attributes': [
                                    'ACS-Allocable-RSVP-Bandwidth',
                                    'ACS-Max-Peak-Bandwidth',
                                    'ACS-Max-Peak-Bandwidth-Per-Flow',
                                    'ACS-Max-Token-Rate-Per-Flow',
                                    'ACS-Service-Type'
                                  ]
                },
            'Group': {
                  'classes': [
                                 'Security-Principal',
                                 'Mail-Recipient'
                               ],
                  'ldapname': 'group',
                  'attributes': [
                                    'Admin-Count',
                                    'Control-Access-Rights',
                                    'Desktop-Profile',
                                    'E-mail-Addresses',
                                    'Group-Attributes',
                                    'Group-Membership-SAM',
                                    'Group-Type',
                                    'Managed-By',
                                    'Member',
                                    'NT-Group-Members',
                                    'Non-Security-Member',
                                    'Operator-Count',
                                    'Primary-Group-Token',
                                    'ms-DS-Az-Application-Data',
                                    'ms-DS-Az-Biz-Rule',
                                    'ms-DS-Az-Biz-Rule-Language',
                                    'ms-DS-Az-Generic-Data',
                                    'ms-DS-Az-LDAP-Query',
                                    'ms-DS-Az-Last-Imported-Biz-Rule-Path',
                                    'ms-DS-Az-Object-Guid',
                                    'ms-DS-Non-Members',
                                    'ms-DS-Primary-Computer',
                                    'msSFU-30-Name',
                                    'msSFU-30-Nis-Domain',
                                    'msSFU-30-Posix-Member'
                                  ]
                },
            'Contact': {
                  'classes': [
                                 'Mail-Recipient'
                               ],
                  'ldapname': 'contact',
                  'attributes': [
                                    'Additional-Information',
                                    'Common-Name',
                                    'ms-DS-Source-Object-DN'
                                  ]
                },
            'ms-DS-Service-Connection-Point-Publication-Service': {
                  'classes': [],
                  'ldapname': 'msDS-ServiceConnectionPointPublicationService',
                  'attributes': [
                                    'Enabled',
                                    'Keywords',
                                    'ms-DS-Disable-For-Instances',
                                    'ms-DS-SCP-Container'
                                  ]
                },
            'Device': {
                  'classes': [],
                  'ldapname': 'device',
                  'attributes': [
                                    'Common-Name',
                                    'Locality-Name',
                                    'Organization-Name',
                                    'Organizational-Unit-Name',
                                    'Owner',
                                    'See-Also',
                                    'Serial-Number',
                                    'msSFU-30-Aliases',
                                    'msSFU-30-Name',
                                    'msSFU-30-Nis-Domain',
                                    'nisMapName'
                                  ]
                },
            'Computer': {
                  'classes': [],
                  'ldapname': 'computer',
                  'attributes': [
                                    'Catalogs',
                                    'Common-Name',
                                    'DNS-Host-Name',
                                    'Default-Local-Policy-Object',
                                    'Local-Policy-Flags',
                                    'Location',
                                    'MS-TS-Property01',
                                    'MS-TS-Property02',
                                    'Machine-Role',
                                    'Managed-By',
                                    'Netboot-GUID',
                                    'Netboot-Initialization',
                                    'Netboot-Machine-File-Path',
                                    'Netboot-Mirror-Data-File',
                                    'Netboot-SIF-File',
                                    'Network-Address',
                                    'Operating-System',
                                    'Operating-System-Hotfix',
                                    'Operating-System-Service-Pack',
                                    'Operating-System-Version',
                                    'Physical-Location-Object',
                                    'Policy-Replication-Flags',
                                    'RID-Set-References',
                                    'Site-GUID',
                                    'Volume-Count',
                                    'ms-DS-Additional-Dns-Host-Name',
                                    'ms-DS-Additional-Sam-Account-Name',
                                    'ms-DS-AuthenticatedAt-DC',
                                    'ms-DS-ExecuteScriptPassword',
                                    'ms-DS-Generation-Id',
                                    'ms-DS-Host-Service-Account',
                                    'ms-DS-Is-User-Cachable-At-Rodc',
                                    'ms-DS-KrbTgt-Link',
                                    'ms-DS-Never-Reveal-Group',
                                    'ms-DS-Promotion-Settings',
                                    'ms-DS-Reveal-OnDemand-Group',
                                    'ms-DS-Revealed-List',
                                    'ms-DS-Revealed-Users',
                                    'ms-DS-SiteName',
                                    'ms-DS-isGC',
                                    'ms-DS-isRODC',
                                    'ms-Imaging-Hash-Algorithm',
                                    'ms-Imaging-Thumbprint-Hash',
                                    'ms-TPM-OwnerInformation',
                                    'ms-TPM-Tpm-Information-For-Computer',
                                    'ms-TS-Endpoint-Data',
                                    'ms-TS-Endpoint-Plugin',
                                    'ms-TS-Endpoint-Type',
                                    'ms-TS-Primary-Desktop-BL',
                                    'ms-TS-Secondary-Desktop-BL',
                                    'msSFU-30-Aliases',
                                    'msSFU-30-Name',
                                    'msSFU-30-Nis-Domain',
                                    'nisMapName'
                                  ]
                },
            'Display-Specifier': {
                  'classes': [],
                  'ldapname': 'displaySpecifier',
                  'attributes': [
                                    'Admin-Context-Menu',
                                    'Admin-Multiselect-Property-Pages',
                                    'Admin-Property-Pages',
                                    'Attribute-Display-Names',
                                    'Class-Display-Name',
                                    'Context-Menu',
                                    'Create-Dialog',
                                    'Create-Wizard-Ext',
                                    'Creation-Wizard',
                                    'Extra-Columns',
                                    'Icon-Path',
                                    'Query-Filter',
                                    'Scope-Flags',
                                    'Shell-Context-Menu',
                                    'Shell-Property-Pages',
                                    'Treat-As-Leaf'
                                  ]
                },
            'DS-UI-Settings': {
                  'classes': [],
                  'ldapname': 'dSUISettings',
                  'attributes': [
                                    'DS-UI-Admin-Maximum',
                                    'DS-UI-Admin-Notification',
                                    'DS-UI-Shell-Maximum',
                                    'ms-DS-Filter-Containers',
                                    'ms-DS-Non-Security-Group-Extra-Classes',
                                    'ms-DS-Security-Group-Extra-Classes'
                                  ]
                },
            'ms-DS-Resource-Properties': {
                  'classes': [],
                  'ldapname': 'msDS-ResourceProperties',
                  'attributes': []
                },
            'ms-DFSR-Subscriber': {
                  'classes': [],
                  'ldapname': 'msDFSR-Subscriber',
                  'attributes': [
                                    'ms-DFSR-Extension',
                                    'ms-DFSR-Flags',
                                    'ms-DFSR-MemberReference',
                                    'ms-DFSR-Options',
                                    'ms-DFSR-Options2',
                                    'ms-DFSR-ReplicationGroupGuid'
                                  ]
                },
            'Server': {
                  'classes': [],
                  'ldapname': 'server',
                  'attributes': [
                                    'Bridgehead-Transport-List',
                                    'DNS-Host-Name',
                                    'Managed-By',
                                    'NETBIOS-Name',
                                    'SMTP-Mail-Address',
                                    'Serial-Number',
                                    'Server-Reference',
                                    'ms-DS-Is-User-Cachable-At-Rodc',
                                    'ms-DS-SiteName',
                                    'ms-DS-isGC',
                                    'ms-DS-isRODC'
                                  ]
                },
            'Index-Server-Catalog': {
                  'classes': [],
                  'ldapname': 'indexServerCatalog',
                  'attributes': [
                                    'Creator',
                                    'Friendly-Names',
                                    'IndexedScopes',
                                    'QueryPoint',
                                    'UNC-Name'
                                  ]
                },
            'Security-Object': {
                  'classes': [],
                  'ldapname': 'securityObject',
                  'attributes': [
                                    'Common-Name'
                                  ]
                },
            'Secret': {
                  'classes': [],
                  'ldapname': 'secret',
                  'attributes': [
                                    'Current-Value',
                                    'Last-Set-Time',
                                    'Prior-Set-Time',
                                    'Prior-Value'
                                  ]
                },
            'ms-WMI-ShadowObject': {
                  'classes': [],
                  'ldapname': 'msWMI-ShadowObject',
                  'attributes': [
                                    'ms-WMI-TargetObject'
                                  ]
                },
            'ms-Imaging-PSPs': {
                  'classes': [],
                  'ldapname': 'msImaging-PSPs',
                  'attributes': []
                },
            'ms-WMI-PolicyType': {
                  'classes': [],
                  'ldapname': 'msWMI-PolicyType',
                  'attributes': [
                                    'ms-WMI-Author',
                                    'ms-WMI-ChangeDate',
                                    'ms-WMI-CreationDate',
                                    'ms-WMI-ID',
                                    'ms-WMI-Parm1',
                                    'ms-WMI-Parm2',
                                    'ms-WMI-Parm3',
                                    'ms-WMI-Parm4',
                                    'ms-WMI-SourceOrganization',
                                    'ms-WMI-TargetObject',
                                    'ms-WMI-intFlags1',
                                    'ms-WMI-intFlags2',
                                    'ms-WMI-intFlags3',
                                    'ms-WMI-intFlags4'
                                  ]
                },
            'documentSeries': {
                  'classes': [],
                  'ldapname': 'documentSeries',
                  'attributes': [
                                    'Common-Name',
                                    'Description',
                                    'Locality-Name',
                                    'Organization-Name',
                                    'Organizational-Unit-Name',
                                    'See-Also',
                                    'Telephone-Number'
                                  ]
                },
            'Display-Template': {
                  'classes': [],
                  'ldapname': 'displayTemplate',
                  'attributes': [
                                    'Address-Entry-Display-Table',
                                    'Address-Entry-Display-Table-MSDOS',
                                    'Common-Name',
                                    'Help-Data16',
                                    'Help-Data32',
                                    'Help-File-Name',
                                    'Original-Display-Table',
                                    'Original-Display-Table-MSDOS'
                                  ]
                },
            'ms-WMI-WMIGPO': {
                  'classes': [],
                  'ldapname': 'msWMI-WMIGPO',
                  'attributes': [
                                    'ms-WMI-Parm1',
                                    'ms-WMI-Parm2',
                                    'ms-WMI-Parm3',
                                    'ms-WMI-Parm4',
                                    'ms-WMI-TargetClass',
                                    'ms-WMI-intFlags1',
                                    'ms-WMI-intFlags2',
                                    'ms-WMI-intFlags3',
                                    'ms-WMI-intFlags4'
                                  ]
                },
            'ms-WMI-RangeParam': {
                  'classes': [],
                  'ldapname': 'msWMI-RangeParam',
                  'attributes': [
                                    'ms-WMI-PropertyName',
                                    'ms-WMI-TargetClass',
                                    'ms-WMI-TargetType'
                                  ]
                },
            'MS-SQL-OLAPServer': {
                  'classes': [],
                  'ldapname': 'mS-SQL-OLAPServer',
                  'attributes': [
                                    'MS-SQL-Build',
                                    'MS-SQL-Contact',
                                    'MS-SQL-InformationURL',
                                    'MS-SQL-Keywords',
                                    'MS-SQL-Language',
                                    'MS-SQL-Name',
                                    'MS-SQL-PublicationURL',
                                    'MS-SQL-RegisteredOwner',
                                    'MS-SQL-ServiceAccount',
                                    'MS-SQL-Status',
                                    'MS-SQL-Version'
                                  ]
                },
            'MSMQ-Settings': {
                  'classes': [],
                  'ldapname': 'mSMQSettings',
                  'attributes': [
                                    'MSMQ-Dependent-Client-Service',
                                    'MSMQ-Ds-Service',
                                    'MSMQ-Migrated',
                                    'MSMQ-Nt4-Flags',
                                    'MSMQ-Owner-ID',
                                    'MSMQ-QM-ID',
                                    'MSMQ-Routing-Service',
                                    'MSMQ-Services',
                                    'MSMQ-Site-Name',
                                    'MSMQ-Site-Name-Ex'
                                  ]
                },
            'RRAS-Administration-Connection-Point': {
                  'classes': [],
                  'ldapname': 'rRASAdministrationConnectionPoint',
                  'attributes': [
                                    'ms-RRAS-Attribute'
                                  ]
                },
            'rpc-Server-Element': {
                  'classes': [],
                  'ldapname': 'rpcServerElement',
                  'attributes': [
                                    'rpc-Ns-Bindings',
                                    'rpc-Ns-Interface-ID',
                                    'rpc-Ns-Transfer-Syntax'
                                  ]
                },
            'ms-Print-ConnectionPolicy': {
                  'classes': [],
                  'ldapname': 'msPrint-ConnectionPolicy',
                  'attributes': [
                                    'Common-Name',
                                    'Print-Attributes',
                                    'Printer-Name',
                                    'Server-Name',
                                    'UNC-Name'
                                  ]
                },
            'NTFRS-Subscriber': {
                  'classes': [],
                  'ldapname': 'nTFRSSubscriber',
                  'attributes': [
                                    'FRS-Extensions',
                                    'FRS-Fault-Condition',
                                    'FRS-Flags',
                                    'FRS-Member-Reference',
                                    'FRS-Root-Path',
                                    'FRS-Service-Command',
                                    'FRS-Service-Command-Status',
                                    'FRS-Staging-Path',
                                    'FRS-Time-Last-Command',
                                    'FRS-Time-Last-Config-Change',
                                    'FRS-Update-Timeout',
                                    'Schedule'
                                  ]
                },
            'nisObject': {
                  'classes': [],
                  'ldapname': 'nisObject',
                  'attributes': [
                                    'Common-Name',
                                    'Description',
                                    'msSFU-30-Name',
                                    'msSFU-30-Nis-Domain',
                                    'nisMapEntry',
                                    'nisMapName'
                                  ]
                },
            'ms-DS-Az-Role': {
                  'classes': [],
                  'ldapname': 'msDS-AzRole',
                  'attributes': [
                                    'Description',
                                    'ms-DS-Az-Application-Data',
                                    'ms-DS-Az-Generic-Data',
                                    'ms-DS-Az-Object-Guid',
                                    'ms-DS-Members-For-Az-Role',
                                    'ms-DS-Operations-For-Az-Role',
                                    'ms-DS-Tasks-For-Az-Role'
                                  ]
                },
            'ms-DFSR-ReplicationGroup': {
                  'classes': [],
                  'ldapname': 'msDFSR-ReplicationGroup',
                  'attributes': [
                                    'Description',
                                    'ms-DFSR-ConflictSizeInMb',
                                    'ms-DFSR-DefaultCompressionExclusionFilter',
                                    'ms-DFSR-DeletedSizeInMb',
                                    'ms-DFSR-DirectoryFilter',
                                    'ms-DFSR-Extension',
                                    'ms-DFSR-FileFilter',
                                    'ms-DFSR-Flags',
                                    'ms-DFSR-OnDemandExclusionDirectoryFilter',
                                    'ms-DFSR-OnDemandExclusionFileFilter',
                                    'ms-DFSR-Options',
                                    'ms-DFSR-Options2',
                                    'ms-DFSR-ReplicationGroupType',
                                    'ms-DFSR-RootSizeInMb',
                                    'ms-DFSR-Schedule',
                                    'ms-DFSR-StagingSizeInMb',
                                    'ms-DFSR-TombstoneExpiryInMin',
                                    'ms-DFSR-Version'
                                  ]
                },
            'ms-COM-PartitionSet': {
                  'classes': [],
                  'ldapname': 'msCOM-PartitionSet',
                  'attributes': [
                                    'ms-COM-DefaultPartitionLink',
                                    'ms-COM-ObjectId',
                                    'ms-COM-PartitionLink'
                                  ]
                },
            'ms-DS-Az-Scope': {
                  'classes': [],
                  'ldapname': 'msDS-AzScope',
                  'attributes': [
                                    'Description',
                                    'ms-DS-Az-Application-Data',
                                    'ms-DS-Az-Generic-Data',
                                    'ms-DS-Az-Object-Guid',
                                    'ms-DS-Az-Scope-Name'
                                  ]
                },
            'bootableDevice': {
                  'classes': [],
                  'ldapname': 'bootableDevice',
                  'attributes': [
                                    'Common-Name',
                                    'bootFile',
                                    'bootParameter'
                                  ]
                },
            'posixGroup': {
                  'classes': [],
                  'ldapname': 'posixGroup',
                  'attributes': [
                                    'Common-Name',
                                    'Description',
                                    'User-Password',
                                    'gidNumber',
                                    'memberUid',
                                    'unixUserPassword'
                                  ]
                },
            'MS-SQL-OLAPCube': {
                  'classes': [],
                  'ldapname': 'mS-SQL-OLAPCube',
                  'attributes': [
                                    'MS-SQL-Contact',
                                    'MS-SQL-Description',
                                    'MS-SQL-InformationURL',
                                    'MS-SQL-Keywords',
                                    'MS-SQL-LastUpdatedDate',
                                    'MS-SQL-Name',
                                    'MS-SQL-PublicationURL',
                                    'MS-SQL-Size',
                                    'MS-SQL-Status'
                                  ]
                },
            'friendlyCountry': {
                  'classes': [],
                  'ldapname': 'friendlyCountry',
                  'attributes': [
                                    'Text-Country'
                                  ]
                },
            'rpc-Profile-Element': {
                  'classes': [],
                  'ldapname': 'rpcProfileElement',
                  'attributes': [
                                    'rpc-Ns-Annotation',
                                    'rpc-Ns-Interface-ID',
                                    'rpc-Ns-Priority',
                                    'rpc-Ns-Profile-Entry'
                                  ]
                },
            'ms-DS-Group-Managed-Service-Account': {
                  'classes': [],
                  'ldapname': 'msDS-GroupManagedServiceAccount',
                  'attributes': [
                                    'ms-DS-GroupMSAMembership',
                                    'ms-DS-ManagedPassword',
                                    'ms-DS-ManagedPasswordId',
                                    'ms-DS-ManagedPasswordInterval',
                                    'ms-DS-ManagedPasswordPreviousId'
                                  ]
                },
            'DSA': {
                  'classes': [],
                  'ldapname': 'dSA',
                  'attributes': [
                                    'Knowledge-Information'
                                  ]
                },
            'Subnet-Container': {
                  'classes': [],
                  'ldapname': 'subnetContainer',
                  'attributes': []
                },
            'ms-DS-Managed-Service-Account': {
                  'classes': [],
                  'ldapname': 'msDS-ManagedServiceAccount',
                  'attributes': []
                },
            'ms-DFSR-Connection': {
                  'classes': [],
                  'ldapname': 'msDFSR-Connection',
                  'attributes': [
                                    'From-Server',
                                    'ms-DFSR-DisablePacketPrivacy',
                                    'ms-DFSR-Enabled',
                                    'ms-DFSR-Extension',
                                    'ms-DFSR-Flags',
                                    'ms-DFSR-Keywords',
                                    'ms-DFSR-Options',
                                    'ms-DFSR-Options2',
                                    'ms-DFSR-Priority',
                                    'ms-DFSR-RdcEnabled',
                                    'ms-DFSR-RdcMinFileSizeInKb',
                                    'ms-DFSR-Schedule'
                                  ]
                },
            'ms-DS-Bind-Proxy': {
                  'classes': [],
                  'ldapname': 'msDS-BindProxy',
                  'attributes': [
                                    'Object-Sid',
                                    'ms-DS-Principal-Name'
                                  ]
                },
            'MSMQ-Migrated-User': {
                  'classes': [],
                  'ldapname': 'mSMQMigratedUser',
                  'attributes': [
                                    'MSMQ-Digests',
                                    'MSMQ-Digests-Mig',
                                    'MSMQ-Sign-Certificates',
                                    'MSMQ-Sign-Certificates-Mig',
                                    'MSMQ-User-Sid',
                                    'Object-Sid'
                                  ]
                },
            'ms-DFS-Deleted-Link-v2': {
                  'classes': [],
                  'ldapname': 'msDFS-DeletedLinkv2',
                  'attributes': [
                                    'ms-DFS-Comment-v2',
                                    'ms-DFS-Last-Modified-v2',
                                    'ms-DFS-Link-Identity-GUID-v2',
                                    'ms-DFS-Link-Path-v2',
                                    'ms-DFS-Namespace-Identity-GUID-v2',
                                    'ms-DFS-Short-Name-Link-Path-v2'
                                  ]
                },
            'ms-WMI-UintRangeParam': {
                  'classes': [],
                  'ldapname': 'msWMI-UintRangeParam',
                  'attributes': [
                                    'ms-WMI-intDefault',
                                    'ms-WMI-intMax',
                                    'ms-WMI-intMin'
                                  ]
                },
            'ms-WMI-IntRangeParam': {
                  'classes': [],
                  'ldapname': 'msWMI-IntRangeParam',
                  'attributes': [
                                    'ms-WMI-intDefault',
                                    'ms-WMI-intMax',
                                    'ms-WMI-intMin'
                                  ]
                },
            'inetOrgPerson': {
                  'classes': [],
                  'ldapname': 'inetOrgPerson',
                  'attributes': [
                                    'Address-Home',
                                    'Business-Category',
                                    'Display-Name',
                                    'E-mail-Addresses',
                                    'Employee-Number',
                                    'Employee-Type',
                                    'Given-Name',
                                    'Initials',
                                    'Manager',
                                    'Organization-Name',
                                    'Phone-Home-Primary',
                                    'Phone-Mobile-Primary',
                                    'Phone-Pager-Primary',
                                    'User-SMIME-Certificate',
                                    'X509-Cert',
                                    'audio',
                                    'carLicense',
                                    'departmentNumber',
                                    'jpegPhoto',
                                    'labeledURI',
                                    'photo',
                                    'preferredLanguage',
                                    'roomNumber',
                                    'secretary',
                                    'uid',
                                    'userPKCS12',
                                    'x500uniqueIdentifier'
                                  ]
                },
            'Physical-Location': {
                  'classes': [],
                  'ldapname': 'physicalLocation',
                  'attributes': [
                                    'Configuration',
                                    'Managed-By'
                                  ]
                },
            'simpleSecurityObject': {
                  'classes': [],
                  'ldapname': 'simpleSecurityObject',
                  'attributes': [
                                    'User-Password'
                                  ]
                },
            'RID-Set': {
                  'classes': [],
                  'ldapname': 'rIDSet',
                  'attributes': [
                                    'RID-Allocation-Pool',
                                    'RID-Next-RID',
                                    'RID-Previous-Allocation-Pool',
                                    'RID-Used-Pool'
                                  ]
                },
            'Person': {
                  'classes': [],
                  'ldapname': 'person',
                  'attributes': [
                                    'Common-Name',
                                    'See-Also',
                                    'Serial-Number',
                                    'Surname',
                                    'Telephone-Number',
                                    'User-Password',
                                    'attributeCertificateAttribute'
                                  ]
                },
            'Application-Version': {
                  'classes': [],
                  'ldapname': 'applicationVersion',
                  'attributes': [
                                    'App-Schema-Version',
                                    'Keywords',
                                    'Managed-By',
                                    'Owner',
                                    'Vendor',
                                    'Version-Number',
                                    'Version-Number-Hi',
                                    'Version-Number-Lo'
                                  ]
                },
            'Foreign-Security-Principal': {
                  'classes': [],
                  'ldapname': 'foreignSecurityPrincipal',
                  'attributes': [
                                    'Foreign-Identifier',
                                    'Object-Sid'
                                  ]
                },
            'ms-WMI-IntSetParam': {
                  'classes': [],
                  'ldapname': 'msWMI-IntSetParam',
                  'attributes': [
                                    'ms-WMI-intDefault',
                                    'ms-WMI-intValidValues'
                                  ]
                },
            'Connection-Point': {
                  'classes': [],
                  'ldapname': 'connectionPoint',
                  'attributes': [
                                    'Common-Name',
                                    'Keywords',
                                    'Managed-By',
                                    'ms-DS-Settings'
                                  ]
                },
            'ms-WMI-Som': {
                  'classes': [],
                  'ldapname': 'msWMI-Som',
                  'attributes': [
                                    'ms-WMI-Author',
                                    'ms-WMI-ChangeDate',
                                    'ms-WMI-CreationDate',
                                    'ms-WMI-ID',
                                    'ms-WMI-Name',
                                    'ms-WMI-Parm1',
                                    'ms-WMI-Parm2',
                                    'ms-WMI-Parm3',
                                    'ms-WMI-Parm4',
                                    'ms-WMI-SourceOrganization',
                                    'ms-WMI-intFlags1',
                                    'ms-WMI-intFlags2',
                                    'ms-WMI-intFlags3',
                                    'ms-WMI-intFlags4'
                                  ]
                },
            'ms-WMI-PolicyTemplate': {
                  'classes': [],
                  'ldapname': 'msWMI-PolicyTemplate',
                  'attributes': [
                                    'ms-WMI-Author',
                                    'ms-WMI-ChangeDate',
                                    'ms-WMI-CreationDate',
                                    'ms-WMI-ID',
                                    'ms-WMI-Name',
                                    'ms-WMI-NormalizedClass',
                                    'ms-WMI-Parm1',
                                    'ms-WMI-Parm2',
                                    'ms-WMI-Parm3',
                                    'ms-WMI-Parm4',
                                    'ms-WMI-SourceOrganization',
                                    'ms-WMI-TargetClass',
                                    'ms-WMI-TargetNameSpace',
                                    'ms-WMI-TargetPath',
                                    'ms-WMI-TargetType',
                                    'ms-WMI-intFlags1',
                                    'ms-WMI-intFlags2',
                                    'ms-WMI-intFlags3',
                                    'ms-WMI-intFlags4'
                                  ]
                },
            'Service-Administration-Point': {
                  'classes': [],
                  'ldapname': 'serviceAdministrationPoint',
                  'attributes': []
                },
            'Volume': {
                  'classes': [],
                  'ldapname': 'volume',
                  'attributes': [
                                    'Content-Indexing-Allowed',
                                    'Last-Content-Indexed',
                                    'UNC-Name'
                                  ]
                },
            'document': {
                  'classes': [],
                  'ldapname': 'document',
                  'attributes': [
                                    'Common-Name',
                                    'Description',
                                    'Locality-Name',
                                    'Organization-Name',
                                    'Organizational-Unit-Name',
                                    'See-Also',
                                    'documentAuthor',
                                    'documentIdentifier',
                                    'documentLocation',
                                    'documentPublisher',
                                    'documentTitle',
                                    'documentVersion'
                                  ]
                },
            'Application-Site-Settings': {
                  'classes': [],
                  'ldapname': 'applicationSiteSettings',
                  'attributes': [
                                    'Application-Name',
                                    'Notification-List'
                                  ]
                },
            'Application-Settings': {
                  'classes': [],
                  'ldapname': 'applicationSettings',
                  'attributes': [
                                    'Application-Name',
                                    'Notification-List',
                                    'ms-DS-Settings'
                                  ]
                },
            'Servers-Container': {
                  'classes': [],
                  'ldapname': 'serversContainer',
                  'attributes': []
                },
            'Domain': {
                  'classes': [],
                  'ldapname': 'domain',
                  'attributes': [
                                    'Domain-Component',
                                    'Organization'
                                  ]
                },
            'Group-Of-Names': {
                  'classes': [],
                  'ldapname': 'groupOfNames',
                  'attributes': [
                                    'Business-Category',
                                    'Common-Name',
                                    'Member',
                                    'Organization-Name',
                                    'Organizational-Unit-Name',
                                    'Owner',
                                    'See-Also'
                                  ]
                },
            'ms-DS-Az-Application': {
                  'classes': [],
                  'ldapname': 'msDS-AzApplication',
                  'attributes': [
                                    'Description',
                                    'ms-DS-Az-Application-Data',
                                    'ms-DS-Az-Application-Name',
                                    'ms-DS-Az-Application-Version',
                                    'ms-DS-Az-Class-ID',
                                    'ms-DS-Az-Generate-Audits',
                                    'ms-DS-Az-Generic-Data',
                                    'ms-DS-Az-Object-Guid'
                                  ]
                },
            'ipHost': {
                  'classes': [],
                  'ldapname': 'ipHost',
                  'attributes': [
                                    'Common-Name',
                                    'Description',
                                    'Locality-Name',
                                    'Manager',
                                    'ipHostNumber',
                                    'uid'
                                  ]
                },
            'ms-WMI-MergeablePolicyTemplate': {
                  'classes': [],
                  'ldapname': 'msWMI-MergeablePolicyTemplate',
                  'attributes': []
                },
            'Ipsec-ISAKMP-Policy': {
                  'classes': [],
                  'ldapname': 'ipsecISAKMPPolicy',
                  'attributes': []
                },
            'ms-WMI-UintSetParam': {
                  'classes': [],
                  'ldapname': 'msWMI-UintSetParam',
                  'attributes': [
                                    'ms-WMI-intDefault',
                                    'ms-WMI-intValidValues'
                                  ]
                },
            'Ipsec-Negotiation-Policy': {
                  'classes': [],
                  'ldapname': 'ipsecNegotiationPolicy',
                  'attributes': [
                                    'IPSEC-Negotiation-Policy-Action',
                                    'IPSEC-Negotiation-Policy-Type'
                                  ]
                },
            'Ipsec-NFA': {
                  'classes': [],
                  'ldapname': 'ipsecNFA',
                  'attributes': [
                                    'Ipsec-Filter-Reference',
                                    'Ipsec-Negotiation-Policy-Reference'
                                  ]
                },
            'ms-net-ieee-8023-GroupPolicy': {
                  'classes': [],
                  'ldapname': 'ms-net-ieee-8023-GroupPolicy',
                  'attributes': [
                                    'ms-net-ieee-8023-GP-PolicyData',
                                    'ms-net-ieee-8023-GP-PolicyGUID',
                                    'ms-net-ieee-8023-GP-PolicyReserved'
                                  ]
                },
            'Country': {
                  'classes': [],
                  'ldapname': 'country',
                  'attributes': [
                                    'Country-Name',
                                    'Search-Guide',
                                    'Text-Country'
                                  ]
                },
            'ipNetwork': {
                  'classes': [],
                  'ldapname': 'ipNetwork',
                  'attributes': [
                                    'Common-Name',
                                    'Description',
                                    'Locality-Name',
                                    'Manager',
                                    'ipNetmaskNumber',
                                    'ipNetworkNumber',
                                    'msSFU-30-Aliases',
                                    'msSFU-30-Name',
                                    'msSFU-30-Nis-Domain',
                                    'nisMapName',
                                    'uid'
                                  ]
                },
            'Leaf': {
                  'classes': [],
                  'ldapname': 'leaf',
                  'attributes': []
                },
            'MSMQ-Enterprise-Settings': {
                  'classes': [],
                  'ldapname': 'mSMQEnterpriseSettings',
                  'attributes': [
                                    'MSMQ-CSP-Name',
                                    'MSMQ-Interval1',
                                    'MSMQ-Interval2',
                                    'MSMQ-Long-Lived',
                                    'MSMQ-Name-Style',
                                    'MSMQ-Version'
                                  ]
                },
            'Application-Entity': {
                  'classes': [],
                  'ldapname': 'applicationEntity',
                  'attributes': [
                                    'Common-Name',
                                    'Locality-Name',
                                    'Organization-Name',
                                    'Organizational-Unit-Name',
                                    'Presentation-Address',
                                    'See-Also',
                                    'Supported-Application-Context'
                                  ]
                },
            'Organizational-Person': {
                  'classes': [],
                  'ldapname': 'organizationalPerson',
                  'attributes': [
                                    'Address',
                                    'Address-Home',
                                    'Assistant',
                                    'Company',
                                    'Country-Code',
                                    'Country-Name',
                                    'Department',
                                    'Destination-Indicator',
                                    'Division',
                                    'E-mail-Addresses',
                                    'Employee-ID',
                                    'Facsimile-Telephone-Number',
                                    'Generation-Qualifier',
                                    'Given-Name',
                                    'Initials',
                                    'International-ISDN-Number',
                                    'Locality-Name',
                                    'Logo',
                                    'MHS-OR-Address',
                                    'Manager',
                                    'Organization-Name',
                                    'Organizational-Unit-Name',
                                    'Other-Mailbox',
                                    'Other-Name',
                                    'Personal-Title',
                                    'Phone-Fax-Other',
                                    'Phone-Home-Other',
                                    'Phone-Home-Primary',
                                    'Phone-ISDN-Primary',
                                    'Phone-Ip-Other',
                                    'Phone-Ip-Primary',
                                    'Phone-Mobile-Other',
                                    'Phone-Mobile-Primary',
                                    'Phone-Office-Other',
                                    'Phone-Pager-Other',
                                    'Phone-Pager-Primary',
                                    'Physical-Delivery-Office-Name',
                                    'Picture',
                                    'Post-Office-Box',
                                    'Postal-Address',
                                    'Postal-Code',
                                    'Preferred-Delivery-Method',
                                    'Registered-Address',
                                    'State-Or-Province-Name',
                                    'Street-Address',
                                    'Teletex-Terminal-Identifier',
                                    'Telex-Number',
                                    'Telex-Primary',
                                    'Text-Country',
                                    'Title',
                                    'User-Comment',
                                    'X121-Address',
                                    'houseIdentifier',
                                    'ms-DS-Allowed-To-Act-On-Behalf-Of-Other-Identity',
                                    'ms-DS-Allowed-To-Delegate-To',
                                    'ms-DS-HAB-Seniority-Index',
                                    'ms-DS-Phonetic-Company-Name',
                                    'ms-DS-Phonetic-Department',
                                    'ms-DS-Phonetic-Display-Name',
                                    'ms-DS-Phonetic-First-Name',
                                    'ms-DS-Phonetic-Last-Name',
                                    'ms-Exch-House-Identifier'
                                  ]
                },
            'Domain-DNS': {
                  'classes': [
                                 'Sam-Domain'
                               ],
                  'ldapname': 'domainDNS',
                  'attributes': [
                                    '',
                                    'Managed-By',
                                    'ms-DS-Allowed-DNS-Suffixes',
                                    'ms-DS-Behavior-Version',
                                    'ms-DS-Enabled-Feature',
                                    'ms-DS-USN-Last-Sync-Success'
                                  ]
                },
            'Infrastructure-Update': {
                  'classes': [],
                  'ldapname': 'infrastructureUpdate',
                  'attributes': [
                                    'DN-Reference-Update',
                                    'Domain'
                                  ]
                },
            'File-Link-Tracking-Entry': {
                  'classes': [],
                  'ldapname': 'fileLinkTrackingEntry',
                  'attributes': []
                },
            'MS-SQL-SQLDatabase': {
                  'classes': [],
                  'ldapname': 'mS-SQL-SQLDatabase',
                  'attributes': [
                                    'MS-SQL-Alias',
                                    'MS-SQL-Applications',
                                    'MS-SQL-Contact',
                                    'MS-SQL-CreationDate',
                                    'MS-SQL-Description',
                                    'MS-SQL-InformationURL',
                                    'MS-SQL-Keywords',
                                    'MS-SQL-LastBackupDate',
                                    'MS-SQL-LastDiagnosticDate',
                                    'MS-SQL-Name',
                                    'MS-SQL-Size',
                                    'MS-SQL-Status'
                                  ]
                },
            'MS-SQL-SQLPublication': {
                  'classes': [],
                  'ldapname': 'mS-SQL-SQLPublication',
                  'attributes': [
                                    'MS-SQL-AllowAnonymousSubscription',
                                    'MS-SQL-AllowImmediateUpdatingSubscription',
                                    'MS-SQL-AllowKnownPullSubscription',
                                    'MS-SQL-AllowQueuedUpdatingSubscription',
                                    'MS-SQL-AllowSnapshotFilesFTPDownloading',
                                    'MS-SQL-Database',
                                    'MS-SQL-Description',
                                    'MS-SQL-Name',
                                    'MS-SQL-Publisher',
                                    'MS-SQL-Status',
                                    'MS-SQL-ThirdParty',
                                    'MS-SQL-Type'
                                  ]
                },
            'PKI-Certificate-Template': {
                  'classes': [],
                  'ldapname': 'pKICertificateTemplate',
                  'attributes': [
                                    'Display-Name',
                                    'Flags',
                                    'PKI-Critical-Extensions',
                                    'PKI-Default-CSPs',
                                    'PKI-Default-Key-Spec',
                                    'PKI-Enrollment-Access',
                                    'PKI-Expiration-Period',
                                    'PKI-Extended-Key-Usage',
                                    'PKI-Key-Usage',
                                    'PKI-Max-Issuing-Depth',
                                    'PKI-Overlap-Period',
                                    'ms-PKI-Cert-Template-OID',
                                    'ms-PKI-Certificate-Application-Policy',
                                    'ms-PKI-Certificate-Name-Flag',
                                    'ms-PKI-Certificate-Policy',
                                    'ms-PKI-Enrollment-Flag',
                                    'ms-PKI-Minimal-Key-Size',
                                    'ms-PKI-Private-Key-Flag',
                                    'ms-PKI-RA-Application-Policies',
                                    'ms-PKI-RA-Policies',
                                    'ms-PKI-RA-Signature',
                                    'ms-PKI-Supersede-Templates',
                                    'ms-PKI-Template-Minor-Revision',
                                    'ms-PKI-Template-Schema-Version'
                                  ]
                },
            'ipProtocol': {
                  'classes': [],
                  'ldapname': 'ipProtocol',
                  'attributes': [
                                    'Common-Name',
                                    'Description',
                                    'ipProtocolNumber',
                                    'msSFU-30-Aliases',
                                    'msSFU-30-Name',
                                    'msSFU-30-Nis-Domain',
                                    'nisMapName'
                                  ]
                },
            'msSFU-30-Mail-Aliases': {
                  'classes': [],
                  'ldapname': 'msSFU30MailAliases',
                  'attributes': [
                                    'msSFU-30-Aliases',
                                    'msSFU-30-Name',
                                    'msSFU-30-Nis-Domain',
                                    'nisMapName'
                                  ]
                },
            'ms-WMI-Rule': {
                  'classes': [],
                  'ldapname': 'msWMI-Rule',
                  'attributes': [
                                    'ms-WMI-Query',
                                    'ms-WMI-QueryLanguage',
                                    'ms-WMI-TargetNameSpace'
                                  ]
                },
            'Package-Registration': {
                  'classes': [],
                  'ldapname': 'packageRegistration',
                  'attributes': [
                                    'COM-ClassID',
                                    'COM-InterfaceID',
                                    'COM-ProgID',
                                    'COM-Typelib-Id',
                                    'Can-Upgrade-Script',
                                    'Categories',
                                    'File-Ext-Priority',
                                    'Icon-Path',
                                    'Install-Ui-Level',
                                    'Last-Update-Sequence',
                                    'Locale-ID',
                                    'Machine-Architecture',
                                    'Managed-By',
                                    'Msi-File-List',
                                    'Msi-Script',
                                    'Msi-Script-Name',
                                    'Msi-Script-Path',
                                    'Msi-Script-Size',
                                    'Package-Flags',
                                    'Package-Name',
                                    'Package-Type',
                                    'Product-Code',
                                    'Setup-Command',
                                    'Upgrade-Product-Code',
                                    'Vendor',
                                    'Version-Number-Hi',
                                    'Version-Number-Lo'
                                  ]
                },
            'MSMQ-Custom-Recipient': {
                  'classes': [],
                  'ldapname': 'msMQ-Custom-Recipient',
                  'attributes': [
                                    'MSMQ-Recipient-FormatName'
                                  ]
                },
            'Application-Process': {
                  'classes': [],
                  'ldapname': 'applicationProcess',
                  'attributes': [
                                    'Common-Name',
                                    'Locality-Name',
                                    'Organizational-Unit-Name',
                                    'See-Also'
                                  ]
                },
            'ms-DS-Value-Type': {
                  'classes': [],
                  'ldapname': 'msDS-ValueType',
                  'attributes': [
                                    'ms-DS-Claim-Is-Single-Valued',
                                    'ms-DS-Claim-Is-Value-Space-Restricted',
                                    'ms-DS-Claim-Value-Type',
                                    'ms-DS-Is-Possible-Values-Present'
                                  ]
                },
            'ms-DS-App-Data': {
                  'classes': [],
                  'ldapname': 'msDS-AppData',
                  'attributes': [
                                    'Keywords',
                                    'Managed-By',
                                    'Owner',
                                    'ms-DS-Byte-Array',
                                    'ms-DS-Date-Time',
                                    'ms-DS-Integer',
                                    'ms-DS-Object-Reference'
                                  ]
                },
            'Service-Connection-Point': {
                  'classes': [],
                  'ldapname': 'serviceConnectionPoint',
                  'attributes': [
                                    'App-Schema-Version',
                                    'Service-Binding-Information',
                                    'Service-Class-Name',
                                    'Service-DNS-Name',
                                    'Service-DNS-Name-Type',
                                    'Vendor',
                                    'Version-Number',
                                    'Version-Number-Hi',
                                    'Version-Number-Lo'
                                  ]
                },
            'ms-DS-Az-Operation': {
                  'classes': [],
                  'ldapname': 'msDS-AzOperation',
                  'attributes': [
                                    'Description',
                                    'ms-DS-Az-Application-Data',
                                    'ms-DS-Az-Generic-Data',
                                    'ms-DS-Az-Object-Guid',
                                    'ms-DS-Az-Operation-ID'
                                  ]
                },
            'ms-Kds-Prov-RootKey': {
                  'classes': [],
                  'ldapname': 'msKds-ProvRootKey',
                  'attributes': [
                                    'Common-Name',
                                    'ms-Kds-CreateTime',
                                    'ms-Kds-DomainID',
                                    'ms-Kds-KDF-AlgorithmID',
                                    'ms-Kds-KDF-Param',
                                    'ms-Kds-PrivateKey-Length',
                                    'ms-Kds-PublicKey-Length',
                                    'ms-Kds-RootKeyData',
                                    'ms-Kds-SecretAgreement-AlgorithmID',
                                    'ms-Kds-SecretAgreement-Param',
                                    'ms-Kds-UseStartTime',
                                    'ms-Kds-Version'
                                  ]
                },
            'Site-Link': {
                  'classes': [],
                  'ldapname': 'siteLink',
                  'attributes': [
                                    'Cost',
                                    'Options',
                                    'Repl-Interval',
                                    'Schedule',
                                    'Site-List'
                                  ]
                },
            'ms-SPP-Activation-Object': {
                  'classes': [],
                  'ldapname': 'msSPP-ActivationObject',
                  'attributes': [
                                    'ms-SPP-CSVLK-Partial-Product-Key',
                                    'ms-SPP-CSVLK-Pid',
                                    'ms-SPP-CSVLK-Sku-Id',
                                    'ms-SPP-Config-License',
                                    'ms-SPP-Confirmation-Id',
                                    'ms-SPP-Installation-Id',
                                    'ms-SPP-Issuance-License',
                                    'ms-SPP-KMS-Ids',
                                    'ms-SPP-Online-License',
                                    'ms-SPP-Phone-License'
                                  ]
                },
            'Domain-Policy': {
                  'classes': [],
                  'ldapname': 'domainPolicy',
                  'attributes': [
                                    'Authentication-Options',
                                    'Default-Local-Policy-Object',
                                    'Domain-Certificate-Authorities',
                                    'Domain-Policy-Reference',
                                    'Domain-Wide-Policy',
                                    'EFSPolicy',
                                    'Force-Logoff',
                                    'Ipsec-Policy-Reference',
                                    'Lock-Out-Observation-Window',
                                    'Lockout-Duration',
                                    'Lockout-Threshold',
                                    'Managed-By',
                                    'Max-Pwd-Age',
                                    'Max-Renew-Age',
                                    'Max-Ticket-Age',
                                    'Min-Pwd-Age',
                                    'Min-Pwd-Length',
                                    'Min-Ticket-Age',
                                    'Proxy-Lifetime',
                                    'Public-Key-Policy',
                                    'Pwd-History-Length',
                                    'Pwd-Properties',
                                    'Quality-Of-Service'
                                  ]
                },
            'ms-WMI-SimplePolicyTemplate': {
                  'classes': [],
                  'ldapname': 'msWMI-SimplePolicyTemplate',
                  'attributes': [
                                    'ms-WMI-TargetObject'
                                  ]
                },
            'ms-TAPI-Rt-Person': {
                  'classes': [],
                  'ldapname': 'msTAPI-RtPerson',
                  'attributes': [
                                    'ms-TAPI-Ip-Address',
                                    'ms-TAPI-Unique-Identifier'
                                  ]
                },
            'Class-Schema': {
                  'classes': [],
                  'ldapname': 'classSchema',
                  'attributes': [
                                    'Auxiliary-Class',
                                    'Class-Display-Name',
                                    'Common-Name',
                                    'Default-Hiding-Value',
                                    'Default-Object-Category',
                                    'Default-Security-Descriptor',
                                    'Governs-ID',
                                    'Is-Defunct',
                                    'LDAP-Display-Name',
                                    'May-Contain',
                                    'Must-Contain',
                                    'Object-Class-Category',
                                    'Poss-Superiors',
                                    'RDN-Att-ID',
                                    'Schema-Flags-Ex',
                                    'Schema-ID-GUID',
                                    'Sub-Class-Of',
                                    'System-Auxiliary-Class',
                                    'System-May-Contain',
                                    'System-Must-Contain',
                                    'System-Only',
                                    'System-Poss-Superiors',
                                    'ms-DS-IntId',
                                    'ms-ds-Schema-Extensions'
                                  ]
                },
            'Intellimirror-SCP': {
                  'classes': [],
                  'ldapname': 'intellimirrorSCP',
                  'attributes': [
                                    'Netboot-Machine-File-Path',
                                    'netboot-Allow-New-Clients',
                                    'netboot-Answer-Only-Valid-Clients',
                                    'netboot-Answer-Requests',
                                    'netboot-Current-Client-Count',
                                    'netboot-IntelliMirror-OSes',
                                    'netboot-Limit-Clients',
                                    'netboot-Locally-Installed-OSes',
                                    'netboot-Max-Clients',
                                    'netboot-New-Machine-Naming-Policy',
                                    'netboot-New-Machine-OU',
                                    'netboot-Server',
                                    'netboot-Tools'
                                  ]
                },
            'DHCP-Class': {
                  'classes': [],
                  'ldapname': 'dHCPClass',
                  'attributes': [
                                    'Mscope-Id',
                                    'Network-Address',
                                    'Option-Description',
                                    'Options-Location',
                                    'Super-Scope-Description',
                                    'Super-Scopes',
                                    'dhcp-Classes',
                                    'dhcp-Flags',
                                    'dhcp-Identification',
                                    'dhcp-Mask',
                                    'dhcp-MaxKey',
                                    'dhcp-Obj-Description',
                                    'dhcp-Obj-Name',
                                    'dhcp-Options',
                                    'dhcp-Properties',
                                    'dhcp-Ranges',
                                    'dhcp-Reservations',
                                    'dhcp-Servers',
                                    'dhcp-Sites',
                                    'dhcp-State',
                                    'dhcp-Subnets',
                                    'dhcp-Type',
                                    'dhcp-Unique-Key',
                                    'dhcp-Update-Time'
                                  ]
                },
            'groupOfUniqueNames': {
                  'classes': [],
                  'ldapname': 'groupOfUniqueNames',
                  'attributes': [
                                    'Business-Category',
                                    'Common-Name',
                                    'Description',
                                    'Organization-Name',
                                    'Organizational-Unit-Name',
                                    'Owner',
                                    'See-Also',
                                    'uniqueMember'
                                  ]
                },
            'msSFU-30-Network-User': {
                  'classes': [],
                  'ldapname': 'msSFU30NetworkUser',
                  'attributes': [
                                    'msSFU-30-Key-Values',
                                    'msSFU-30-Name',
                                    'msSFU-30-Nis-Domain',
                                    'nisMapName'
                                  ]
                },
            'Link-Track-OMT-Entry': {
                  'classes': [],
                  'ldapname': 'linkTrackOMTEntry',
                  'attributes': [
                                    'Birth-Location',
                                    'Current-Location',
                                    'OMT-Guid',
                                    'OMT-Indx-Guid',
                                    'Time-Refresh'
                                  ]
                },
            'Site-Link-Bridge': {
                  'classes': [],
                  'ldapname': 'siteLinkBridge',
                  'attributes': [
                                    'Site-Link-List'
                                  ]
                },
            'Certification-Authority': {
                  'classes': [],
                  'ldapname': 'certificationAuthority',
                  'attributes': [
                                    'Authority-Revocation-List',
                                    'CA-Certificate',
                                    'CA-Certificate-DN',
                                    'CA-Connect',
                                    'CA-Usages',
                                    'CA-WEB-URL',
                                    'CRL-Object',
                                    'Certificate-Revocation-List',
                                    'Certificate-Templates',
                                    'Common-Name',
                                    'Cross-Certificate-Pair',
                                    'Current-Parent-CA',
                                    'DNS-Host-Name',
                                    'Delta-Revocation-List',
                                    'Domain-ID',
                                    'Domain-Policy-Object',
                                    'Enrollment-Providers',
                                    'Parent-CA',
                                    'Parent-CA-Certificate-Chain',
                                    'Pending-CA-Certificates',
                                    'Pending-Parent-CA',
                                    'Previous-CA-Certificates',
                                    'Previous-Parent-CA',
                                    'Search-Guide',
                                    'Signature-Algorithms',
                                    'Supported-Application-Context',
                                    'Teletex-Terminal-Identifier'
                                  ]
                },
            'Dfs-Configuration': {
                  'classes': [],
                  'ldapname': 'dfsConfiguration',
                  'attributes': []
                },
            'Link-Track-Vol-Entry': {
                  'classes': [],
                  'ldapname': 'linkTrackVolEntry',
                  'attributes': [
                                    'Curr-Machine-Id',
                                    'Link-Track-Secret',
                                    'Object-Count',
                                    'Seq-Notification',
                                    'Time-Refresh',
                                    'Time-Vol-Change',
                                    'Vol-Table-GUID',
                                    'Vol-Table-Idx-GUID'
                                  ]
                },
            'NTDS-DSA': {
                  'classes': [],
                  'ldapname': 'nTDSDSA',
                  'attributes': [
                                    'DMD-Location',
                                    'FRS-Root-Path',
                                    'Has-Master-NCs',
                                    'Has-Partial-Replica-NCs',
                                    'Invocation-Id',
                                    'Last-Backup-Restoration-Time',
                                    'Managed-By',
                                    'Network-Address',
                                    'Options',
                                    'Query-Policy-Object',
                                    'Retired-Repl-DSA-Signatures',
                                    'Server-Reference',
                                    'ms-DS-Behavior-Version',
                                    'ms-DS-Enabled-Feature',
                                    'ms-DS-Has-Domain-NCs',
                                    'ms-DS-Has-Full-Replica-NCs',
                                    'ms-DS-Has-Instantiated-NCs',
                                    'ms-DS-Has-Master-NCs',
                                    'ms-DS-Is-User-Cachable-At-Rodc',
                                    'ms-DS-Never-Reveal-Group',
                                    'ms-DS-Port-LDAP',
                                    'ms-DS-Port-SSL',
                                    'ms-DS-ReplicationEpoch',
                                    'ms-DS-Retired-Repl-NC-Signatures',
                                    'ms-DS-Reveal-OnDemand-Group',
                                    'ms-DS-Revealed-Users',
                                    'ms-DS-Service-Account',
                                    'ms-DS-Service-Account-DNS-Domain',
                                    'ms-DS-SiteName',
                                    'ms-DS-isGC',
                                    'ms-DS-isRODC'
                                  ]
                },
            'ms-Authz-Central-Access-Policy': {
                  'classes': [],
                  'ldapname': 'msAuthz-CentralAccessPolicy',
                  'attributes': [
                                    'ms-Authz-Central-Access-Policy-ID',
                                    'ms-Authz-Member-Rules-In-Central-Access-Policy'
                                  ]
                },
            'oncRpc': {
                  'classes': [],
                  'ldapname': 'oncRpc',
                  'attributes': [
                                    'Common-Name',
                                    'Description',
                                    'msSFU-30-Aliases',
                                    'msSFU-30-Name',
                                    'msSFU-30-Nis-Domain',
                                    'nisMapName',
                                    'oncRpcNumber'
                                  ]
                },
            'ms-DS-Quota-Control': {
                  'classes': [],
                  'ldapname': 'msDS-QuotaControl',
                  'attributes': [
                                    'Common-Name',
                                    'ms-DS-Quota-Amount',
                                    'ms-DS-Quota-Trustee'
                                  ]
                },
            'Rpc-Container': {
                  'classes': [],
                  'ldapname': 'rpcContainer',
                  'attributes': [
                                    'Name-Service-Flags'
                                  ]
                },
            'ms-DS-App-Configuration': {
                  'classes': [],
                  'ldapname': 'msDS-App-Configuration',
                  'attributes': [
                                    'Keywords',
                                    'Managed-By',
                                    'Owner',
                                    'ms-DS-Byte-Array',
                                    'ms-DS-Date-Time',
                                    'ms-DS-Integer',
                                    'ms-DS-Object-Reference'
                                  ]
                },
            'DMD': {
                  'classes': [],
                  'ldapname': 'dMD',
                  'attributes': [
                                    'Common-Name',
                                    'DMD-Name',
                                    'Prefix-Map',
                                    'Schema-Info',
                                    'Schema-Update',
                                    'ms-DS-IntId',
                                    'ms-DS-USN-Last-Sync-Success',
                                    'ms-ds-Schema-Extensions'
                                  ]
                },
            'ms-DS-Claims-Transformation-Policy-Type': {
                  'classes': [],
                  'ldapname': 'msDS-ClaimsTransformationPolicyType',
                  'attributes': [
                                    'ms-DS-Transformation-Rules',
                                    'ms-DS-Transformation-Rules-Compiled'
                                  ]
                },
            'ms-Kds-Prov-ServerConfiguration': {
                  'classes': [],
                  'ldapname': 'msKds-ProvServerConfiguration',
                  'attributes': [
                                    'ms-Kds-KDF-AlgorithmID',
                                    'ms-Kds-KDF-Param',
                                    'ms-Kds-PrivateKey-Length',
                                    'ms-Kds-PublicKey-Length',
                                    'ms-Kds-SecretAgreement-AlgorithmID',
                                    'ms-Kds-SecretAgreement-Param',
                                    'ms-Kds-Version'
                                  ]
                },
            'Subnet': {
                  'classes': [],
                  'ldapname': 'subnet',
                  'attributes': [
                                    'Location',
                                    'Physical-Location-Object',
                                    'Site-Object'
                                  ]
                },
            'Group-Policy-Container': {
                  'classes': [],
                  'ldapname': 'groupPolicyContainer',
                  'attributes': [
                                    'Flags',
                                    'GPC-File-Sys-Path',
                                    'GPC-Functionality-Version',
                                    'GPC-Machine-Extension-Names',
                                    'GPC-User-Extension-Names',
                                    'GPC-WQL-Filter',
                                    'Version-Number'
                                  ]
                },
            'Container': {
                  'classes': [],
                  'ldapname': 'container',
                  'attributes': [
                                    'Common-Name',
                                    'Default-Class-Store',
                                    'Organizational-Unit',
                                    'Schema-Version',
                                    'ms-DS-Object-Reference'
                                  ]
                },
            'ms-PKI-Enterprise-Oid': {
                  'classes': [],
                  'ldapname': 'msPKI-Enterprise-Oid',
                  'attributes': [
                                    'Container',
                                    'ms-DS-OIDToGroup-Link',
                                    'ms-PKI-Cert-Template-OID',
                                    'ms-PKI-OID-Attribute',
                                    'ms-PKI-OID-CPS',
                                    'ms-PKI-OID-LocalizedName',
                                    'ms-PKI-OID-User-Notice'
                                  ]
                },
            'msSFU-30-NIS-Map-Config': {
                  'classes': [],
                  'ldapname': 'msSFU30NISMapConfig',
                  'attributes': [
                                    'msSFU-30-Field-Separator',
                                    'msSFU-30-Intra-Field-Separator',
                                    'msSFU-30-Key-Attributes',
                                    'msSFU-30-Map-Filter',
                                    'msSFU-30-NSMAP-Field-Position',
                                    'msSFU-30-Result-Attributes',
                                    'msSFU-30-Search-Attributes'
                                  ]
                },
            'Class-Store': {
                  'classes': [],
                  'ldapname': 'classStore',
                  'attributes': [
                                    'App-Schema-Version',
                                    'Container',
                                    'Last-Update-Sequence',
                                    'Next-Level-Store',
                                    'Version-Number'
                                  ]
                },
            'MS-SQL-OLAPDatabase': {
                  'classes': [],
                  'ldapname': 'mS-SQL-OLAPDatabase',
                  'attributes': [
                                    'MS-SQL-Applications',
                                    'MS-SQL-ConnectionURL',
                                    'MS-SQL-Contact',
                                    'MS-SQL-Description',
                                    'MS-SQL-InformationURL',
                                    'MS-SQL-Keywords',
                                    'MS-SQL-LastBackupDate',
                                    'MS-SQL-LastUpdatedDate',
                                    'MS-SQL-Name',
                                    'MS-SQL-PublicationURL',
                                    'MS-SQL-Size',
                                    'MS-SQL-Status',
                                    'MS-SQL-Type'
                                  ]
                },
            'Lost-And-Found': {
                  'classes': [],
                  'ldapname': 'lostAndFound',
                  'attributes': [
                                    'Move-Tree-State'
                                  ]
                },
            'Remote-Mail-Recipient': {
                  'classes': [
                                 'Mail-Recipient'
                               ],
                  'ldapname': 'remoteMailRecipient',
                  'attributes': [
                                    'Managed-By',
                                    'Remote-Source',
                                    'Remote-Source-Type'
                                  ]
                },
            'Builtin-Domain': {
                  'classes': [
                                 'Sam-Domain-Base'
                               ],
                  'ldapname': 'builtinDomain',
                  'attributes': []
                },
            'ms-DS-Resource-Property-List': {
                  'classes': [],
                  'ldapname': 'msDS-ResourcePropertyList',
                  'attributes': [
                                    'ms-DS-Members-Of-Resource-Property-List'
                                  ]
                },
            'ipService': {
                  'classes': [],
                  'ldapname': 'ipService',
                  'attributes': [
                                    'Common-Name',
                                    'Description',
                                    'ipServicePort',
                                    'ipServiceProtocol',
                                    'msSFU-30-Aliases',
                                    'msSFU-30-Name',
                                    'msSFU-30-Nis-Domain',
                                    'nisMapName'
                                  ]
                },
            'room': {
                  'classes': [],
                  'ldapname': 'room',
                  'attributes': [
                                    'Common-Name',
                                    'Description',
                                    'Location',
                                    'See-Also',
                                    'Telephone-Number',
                                    'roomNumber'
                                  ]
                },
            'shadowAccount': {
                  'classes': [],
                  'ldapname': 'shadowAccount',
                  'attributes': [
                                    'Description',
                                    'User-Password',
                                    'shadowExpire',
                                    'shadowFlag',
                                    'shadowInactive',
                                    'shadowLastChange',
                                    'shadowMax',
                                    'shadowMin',
                                    'shadowWarning',
                                    'uid'
                                  ]
                },
            'Service-Class': {
                  'classes': [],
                  'ldapname': 'serviceClass',
                  'attributes': [
                                    'Display-Name',
                                    'Service-Class-ID',
                                    'Service-Class-Info'
                                  ]
                },
            'NTDS-DSA-RO': {
                  'classes': [],
                  'ldapname': 'nTDSDSARO',
                  'attributes': []
                },
            'NTFRS-Member': {
                  'classes': [],
                  'ldapname': 'nTFRSMember',
                  'attributes': [
                                    'FRS-Control-Data-Creation',
                                    'FRS-Control-Inbound-Backlog',
                                    'FRS-Control-Outbound-Backlog',
                                    'FRS-Extensions',
                                    'FRS-Flags',
                                    'FRS-Partner-Auth-Level',
                                    'FRS-Root-Security',
                                    'FRS-Service-Command',
                                    'FRS-Update-Timeout',
                                    'Frs-Computer-Reference',
                                    'Server-Reference'
                                  ]
                },
            'Site': {
                  'classes': [],
                  'ldapname': 'site',
                  'attributes': [
                                    'GP-Link',
                                    'GP-Options',
                                    'Location',
                                    'MSMQ-Interval1',
                                    'MSMQ-Interval2',
                                    'MSMQ-Nt4-Stub',
                                    'MSMQ-Site-Foreign',
                                    'MSMQ-Site-ID',
                                    'Managed-By',
                                    'Notification-List',
                                    'ms-DS-BridgeHead-Servers-Used'
                                  ]
                },
            'Cross-Ref': {
                  'classes': [],
                  'ldapname': 'crossRef',
                  'attributes': [
                                    'Common-Name',
                                    'Dns-Root',
                                    'Enabled',
                                    'NC-Name',
                                    'NETBIOS-Name',
                                    'NT-Mixed-Domain',
                                    'Root-Trust',
                                    'Superior-DNS-Root',
                                    'Trust-Parent',
                                    'ms-DS-Behavior-Version',
                                    'ms-DS-DnsRootAlias',
                                    'ms-DS-NC-RO-Replica-Locations',
                                    'ms-DS-NC-Replica-Locations',
                                    'ms-DS-Replication-Notify-First-DSA-Delay',
                                    'ms-DS-Replication-Notify-Subsequent-DSA-Delay',
                                    'ms-DS-SD-Reference-Domain'
                                  ]
                },
            'ms-DFS-Link-v2': {
                  'classes': [],
                  'ldapname': 'msDFS-Linkv2',
                  'attributes': [
                                    'ms-DFS-Comment-v2',
                                    'ms-DFS-Generation-GUID-v2',
                                    'ms-DFS-Last-Modified-v2',
                                    'ms-DFS-Link-Identity-GUID-v2',
                                    'ms-DFS-Link-Path-v2',
                                    'ms-DFS-Link-Security-Descriptor-v2',
                                    'ms-DFS-Namespace-Identity-GUID-v2',
                                    'ms-DFS-Properties-v2',
                                    'ms-DFS-Short-Name-Link-Path-v2',
                                    'ms-DFS-Target-List-v2',
                                    'ms-DFS-Ttl-v2'
                                  ]
                },
            'ms-DS-Bindable-Object': {
                  'classes': [],
                  'ldapname': 'msDS-BindableObject',
                  'attributes': [
                                    'Account-Expires',
                                    'Bad-Password-Time',
                                    'Bad-Pwd-Count',
                                    'Last-Logon-Timestamp',
                                    'Lockout-Time',
                                    'Nt-Pwd-History',
                                    'Pwd-Last-Set',
                                    'Unicode-Pwd',
                                    'ms-DS-User-Account-Auto-Locked',
                                    'ms-DS-User-Account-Control-Computed',
                                    'ms-DS-User-Account-Disabled',
                                    'ms-DS-User-Dont-Expire-Password',
                                    'ms-DS-User-Encrypted-Text-Password-Allowed',
                                    'ms-DS-User-Password-Expired',
                                    'ms-DS-User-Password-Not-Required'
                                  ]
                },
            'File-Link-Tracking': {
                  'classes': [],
                  'ldapname': 'fileLinkTracking',
                  'attributes': []
                },
            'Class-Registration': {
                  'classes': [],
                  'ldapname': 'classRegistration',
                  'attributes': [
                                    'COM-CLSID',
                                    'COM-InterfaceID',
                                    'COM-Other-Prog-Id',
                                    'COM-ProgID',
                                    'COM-Treat-As-Class-Id',
                                    'Implemented-Categories',
                                    'Managed-By',
                                    'Required-Categories'
                                  ]
                },
            'Configuration': {
                  'classes': [],
                  'ldapname': 'configuration',
                  'attributes': [
                                    'Common-Name',
                                    'GP-Link',
                                    'GP-Options',
                                    'ms-DS-Repl-Authentication-Mode',
                                    'ms-DS-USN-Last-Sync-Success'
                                  ]
                },
            'ms-SPP-Activation-Objects-Container': {
                  'classes': [],
                  'ldapname': 'msSPP-ActivationObjectsContainer',
                  'attributes': []
                },
            'Organization': {
                  'classes': [],
                  'ldapname': 'organization',
                  'attributes': [
                                    'Business-Category',
                                    'Destination-Indicator',
                                    'Facsimile-Telephone-Number',
                                    'International-ISDN-Number',
                                    'Locality-Name',
                                    'Organization-Name',
                                    'Physical-Delivery-Office-Name',
                                    'Post-Office-Box',
                                    'Postal-Address',
                                    'Postal-Code',
                                    'Preferred-Delivery-Method',
                                    'Registered-Address',
                                    'Search-Guide',
                                    'See-Also',
                                    'State-Or-Province-Name',
                                    'Street-Address',
                                    'Telephone-Number',
                                    'Teletex-Terminal-Identifier',
                                    'Telex-Number',
                                    'User-Password',
                                    'X121-Address'
                                  ]
                },
            'Trusted-Domain': {
                  'classes': [],
                  'ldapname': 'trustedDomain',
                  'attributes': [
                                    'Additional-Trusted-Service-Names',
                                    'Domain-Cross-Ref',
                                    'Domain-Identifier',
                                    'Flat-Name',
                                    'Initial-Auth-Incoming',
                                    'Initial-Auth-Outgoing',
                                    'MS-DS-Creator-SID',
                                    'Security-Identifier',
                                    'Trust-Attributes',
                                    'Trust-Auth-Incoming',
                                    'Trust-Auth-Outgoing',
                                    'Trust-Direction',
                                    'Trust-Partner',
                                    'Trust-Posix-Offset',
                                    'Trust-Type',
                                    'ms-DS-Egress-Claims-Transformation-Policy',
                                    'ms-DS-Ingress-Claims-Transformation-Policy',
                                    'ms-DS-Supported-Encryption-Types',
                                    'ms-DS-Trust-Forest-Trust-Info'
                                  ]
                },
            'ms-Imaging-PostScanProcess': {
                  'classes': [],
                  'ldapname': 'msImaging-PostScanProcess',
                  'attributes': [
                                    'Display-Name',
                                    'Server-Name',
                                    'ms-Imaging-PSP-Identifier',
                                    'ms-Imaging-PSP-String'
                                  ]
                },
            'MSMQ-Queue': {
                  'classes': [],
                  'ldapname': 'mSMQQueue',
                  'attributes': [
                                    'MSMQ-Authenticate',
                                    'MSMQ-Base-Priority',
                                    'MSMQ-Journal',
                                    'MSMQ-Label',
                                    'MSMQ-Label-Ex',
                                    'MSMQ-Multicast-Address',
                                    'MSMQ-Owner-ID',
                                    'MSMQ-Privacy-Level',
                                    'MSMQ-Queue-Journal-Quota',
                                    'MSMQ-Queue-Name-Ext',
                                    'MSMQ-Queue-Quota',
                                    'MSMQ-Queue-Type',
                                    'MSMQ-Secured-Source',
                                    'MSMQ-Transactional'
                                  ]
                },
            'Dns-Node': {
                  'classes': [],
                  'ldapname': 'dnsNode',
                  'attributes': [
                                    'DNS-Property',
                                    'DNS-Tombstoned',
                                    'Dns-Record',
                                    'Domain-Component'
                                  ]
                },
            'ms-DS-Claim-Type': {
                  'classes': [],
                  'ldapname': 'msDS-ClaimType',
                  'attributes': [
                                    'ms-DS-Claim-Attribute-Source',
                                    'ms-DS-Claim-Is-Single-Valued',
                                    'ms-DS-Claim-Is-Value-Space-Restricted',
                                    'ms-DS-Claim-Source',
                                    'ms-DS-Claim-Source-Type',
                                    'ms-DS-Claim-Type-Applies-To-Class',
                                    'ms-DS-Claim-Value-Type'
                                  ]
                },
            'ms-DFSR-LocalSettings': {
                  'classes': [],
                  'ldapname': 'msDFSR-LocalSettings',
                  'attributes': [
                                    'ms-DFSR-CommonStagingPath',
                                    'ms-DFSR-CommonStagingSizeInMb',
                                    'ms-DFSR-Extension',
                                    'ms-DFSR-Flags',
                                    'ms-DFSR-Options',
                                    'ms-DFSR-Options2',
                                    'ms-DFSR-StagingCleanupTriggerInPercent',
                                    'ms-DFSR-Version'
                                  ]
                },
            'ms-Authz-Central-Access-Rules': {
                  'classes': [],
                  'ldapname': 'msAuthz-CentralAccessRules',
                  'attributes': []
                },
            'MSMQ-Group': {
                  'classes': [],
                  'ldapname': 'msMQ-Group',
                  'attributes': [
                                    'Member'
                                  ]
                },
            'ms-DS-Password-Settings': {
                  'classes': [],
                  'ldapname': 'msDS-PasswordSettings',
                  'attributes': [
                                    'ms-DS-Lockout-Duration',
                                    'ms-DS-Lockout-Observation-Window',
                                    'ms-DS-Lockout-Threshold',
                                    'ms-DS-Maximum-Password-Age',
                                    'ms-DS-Minimum-Password-Age',
                                    'ms-DS-Minimum-Password-Length',
                                    'ms-DS-PSO-Applies-To',
                                    'ms-DS-Password-Complexity-Enabled',
                                    'ms-DS-Password-History-Length',
                                    'ms-DS-Password-Reversible-Encryption-Enabled',
                                    'ms-DS-Password-Settings-Precedence'
                                  ]
                },
            'ms-DFSR-Member': {
                  'classes': [],
                  'ldapname': 'msDFSR-Member',
                  'attributes': [
                                    'Server-Reference',
                                    'ms-DFSR-ComputerReference',
                                    'ms-DFSR-Extension',
                                    'ms-DFSR-Flags',
                                    'ms-DFSR-Keywords',
                                    'ms-DFSR-Options',
                                    'ms-DFSR-Options2'
                                  ]
                },
            'rpc-Profile': {
                  'classes': [],
                  'ldapname': 'rpcProfile',
                  'attributes': []
                },
            'ms-Authz-Central-Access-Rule': {
                  'classes': [],
                  'ldapname': 'msAuthz-CentralAccessRule',
                  'attributes': [
                                    'Enabled',
                                    'ms-Authz-Effective-Security-Policy',
                                    'ms-Authz-Last-Effective-Security-Policy',
                                    'ms-Authz-Proposed-Security-Policy',
                                    'ms-Authz-Resource-Condition'
                                  ]
                },
            'Link-Track-Volume-Table': {
                  'classes': [],
                  'ldapname': 'linkTrackVolumeTable',
                  'attributes': []
                },
            'ms-DS-Optional-Feature': {
                  'classes': [],
                  'ldapname': 'msDS-OptionalFeature',
                  'attributes': [
                                    'ms-DS-Optional-Feature-Flags',
                                    'ms-DS-Optional-Feature-GUID',
                                    'ms-DS-Required-Domain-Behavior-Version',
                                    'ms-DS-Required-Forest-Behavior-Version'
                                  ]
                },
            'User': {
                  'classes': [
                                 'Mail-Recipient',
                                 'Security-Principal'
                               ],
                  'ldapname': 'user',
                  'attributes': [
                                    'ACS-Policy-Name',
                                    'Account-Expires',
                                    'Address-Home',
                                    'Admin-Count',
                                    'Bad-Password-Time',
                                    'Bad-Pwd-Count',
                                    'Business-Category',
                                    'Code-Page',
                                    'Control-Access-Rights',
                                    'DBCS-Pwd',
                                    'Default-Class-Store',
                                    'Desktop-Profile',
                                    'Display-Name',
                                    'Dynamic-LDAP-Server',
                                    'E-mail-Addresses',
                                    'Employee-Number',
                                    'Employee-Type',
                                    'Given-Name',
                                    'Group-Membership-SAM',
                                    'Group-Priority',
                                    'Groups-to-Ignore',
                                    'Home-Directory',
                                    'Home-Drive',
                                    'Initials',
                                    'Last-Logoff',
                                    'Last-Logon',
                                    'Last-Logon-Timestamp',
                                    'Lm-Pwd-History',
                                    'Locale-ID',
                                    'Lockout-Time',
                                    'Logon-Count',
                                    'Logon-Hours',
                                    'Logon-Workstation',
                                    'MS-DRM-Identity-Certificate',
                                    'MS-DS-Creator-SID',
                                    'MS-TS-ExpireDate',
                                    'MS-TS-ExpireDate2',
                                    'MS-TS-ExpireDate3',
                                    'MS-TS-ExpireDate4',
                                    'MS-TS-LicenseVersion',
                                    'MS-TS-LicenseVersion2',
                                    'MS-TS-LicenseVersion3',
                                    'MS-TS-LicenseVersion4',
                                    'MS-TS-ManagingLS',
                                    'MS-TS-ManagingLS2',
                                    'MS-TS-ManagingLS3',
                                    'MS-TS-ManagingLS4',
                                    'MS-TS-Property01',
                                    'MS-TS-Property02',
                                    'MS-TSLS-Property01',
                                    'MS-TSLS-Property02',
                                    'MSMQ-Digests',
                                    'MSMQ-Digests-Mig',
                                    'MSMQ-Sign-Certificates',
                                    'MSMQ-Sign-Certificates-Mig',
                                    'Manager',
                                    'Max-Storage',
                                    'Network-Address',
                                    'Nt-Pwd-History',
                                    'Operator-Count',
                                    'Organization-Name',
                                    'Other-Login-Workstations',
                                    'Phone-Home-Primary',
                                    'Phone-Mobile-Primary',
                                    'Phone-Pager-Primary',
                                    'Preferred-OU',
                                    'Primary-Group-ID',
                                    'Profile-Path',
                                    'Pwd-Last-Set',
                                    'Script-Path',
                                    'Service-Principal-Name',
                                    'Terminal-Server',
                                    'Unicode-Pwd',
                                    'User-Account-Control',
                                    'User-Parameters',
                                    'User-Principal-Name',
                                    'User-SMIME-Certificate',
                                    'User-Shared-Folder',
                                    'User-Shared-Folder-Other',
                                    'User-Workstations',
                                    'X509-Cert',
                                    'audio',
                                    'carLicense',
                                    'departmentNumber',
                                    'jpegPhoto',
                                    'labeledURI',
                                    'ms-COM-UserPartitionSetLink',
                                    'ms-DS-AuthenticatedAt-DC',
                                    'ms-DS-Cached-Membership',
                                    'ms-DS-Cached-Membership-Time-Stamp',
                                    'ms-DS-Failed-Interactive-Logon-Count',
                                    'ms-DS-Failed-Interactive-Logon-Count-At-Last-Successful-Logon',
                                    'ms-DS-Last-Failed-Interactive-Logon-Time',
                                    'ms-DS-Last-Successful-Interactive-Logon-Time',
                                    'ms-DS-Primary-Computer',
                                    'ms-DS-Resultant-PSO',
                                    'ms-DS-Secondary-KrbTgt-Number',
                                    'ms-DS-Site-Affinity',
                                    'ms-DS-Source-Object-DN',
                                    'ms-DS-Supported-Encryption-Types',
                                    'ms-DS-User-Account-Control-Computed',
                                    'ms-DS-User-Password-Expiry-Time-Computed',
                                    'ms-IIS-FTP-Dir',
                                    'ms-IIS-FTP-Root',
                                    'ms-PKI-AccountCredentials',
                                    'ms-PKI-Credential-Roaming-Tokens',
                                    'ms-PKI-DPAPIMasterKeys',
                                    'ms-PKI-RoamingTimeStamp',
                                    'ms-RADIUS-FramedInterfaceId',
                                    'ms-RADIUS-FramedIpv6Prefix',
                                    'ms-RADIUS-FramedIpv6Route',
                                    'ms-RADIUS-SavedFramedInterfaceId',
                                    'ms-RADIUS-SavedFramedIpv6Prefix',
                                    'ms-RADIUS-SavedFramedIpv6Route',
                                    'ms-TS-Allow-Logon',
                                    'ms-TS-Broken-Connection-Action',
                                    'ms-TS-Connect-Client-Drives',
                                    'ms-TS-Connect-Printer-Drives',
                                    'ms-TS-Default-To-Main-Printer',
                                    'ms-TS-Home-Directory',
                                    'ms-TS-Home-Drive',
                                    'ms-TS-Initial-Program',
                                    'ms-TS-Max-Connection-Time',
                                    'ms-TS-Max-Disconnection-Time',
                                    'ms-TS-Max-Idle-Time',
                                    'ms-TS-Primary-Desktop',
                                    'ms-TS-Profile-Path',
                                    'ms-TS-Reconnection-Action',
                                    'ms-TS-Remote-Control',
                                    'ms-TS-Secondary-Desktops',
                                    'ms-TS-Work-Directory',
                                    'msNPAllowDialin',
                                    'msNPCallingStationID',
                                    'msNPSavedCallingStationID',
                                    'msRADIUSCallbackNumber',
                                    'msRADIUSFramedIPAddress',
                                    'msRADIUSFramedRoute',
                                    'msRADIUSServiceType',
                                    'msRASSavedCallbackNumber',
                                    'msRASSavedFramedIPAddress',
                                    'msRASSavedFramedRoute',
                                    'msSFU-30-Name',
                                    'msSFU-30-Nis-Domain',
                                    'photo',
                                    'preferredLanguage',
                                    'roomNumber',
                                    'secretary',
                                    'uid',
                                    'userPKCS12',
                                    'x500uniqueIdentifier'
                                  ]
                },
            'ms-PKI-Private-Key-Recovery-Agent': {
                  'classes': [],
                  'ldapname': 'msPKI-PrivateKeyRecoveryAgent',
                  'attributes': [
                                    'X509-Cert'
                                  ]
                },
            'Sites-Container': {
                  'classes': [],
                  'ldapname': 'sitesContainer',
                  'attributes': []
                },
            'posixAccount': {
                  'classes': [],
                  'ldapname': 'posixAccount',
                  'attributes': [
                                    'Common-Name',
                                    'Description',
                                    'Home-Directory',
                                    'User-Password',
                                    'gecos',
                                    'gidNumber',
                                    'loginShell',
                                    'uid',
                                    'uidNumber',
                                    'unixHomeDirectory',
                                    'unixUserPassword'
                                  ]
                },
            'SubSchema': {
                  'classes': [],
                  'ldapname': 'subSchema',
                  'attributes': [
                                    'Attribute-Types',
                                    'DIT-Content-Rules',
                                    'Extended-Attribute-Info',
                                    'Extended-Class-Info',
                                    'Modify-Time-Stamp',
                                    'Object-Classes'
                                  ]
                },
            'Sam-Domain-Base': {
                  'classes': [],
                  'ldapname': 'samDomainBase',
                  'attributes': [
                                    'Creation-Time',
                                    'Domain-Replica',
                                    'Force-Logoff',
                                    'Lock-Out-Observation-Window',
                                    'Lockout-Duration',
                                    'Lockout-Threshold',
                                    'Max-Pwd-Age',
                                    'Min-Pwd-Age',
                                    'Min-Pwd-Length',
                                    'Modified-Count',
                                    'Modified-Count-At-Last-Prom',
                                    'NT-Security-Descriptor',
                                    'Next-Rid',
                                    'OEM-Information',
                                    'Object-Sid',
                                    'Pwd-History-Length',
                                    'Pwd-Properties',
                                    'Revision',
                                    'Server-Role',
                                    'Server-State',
                                    'UAS-Compat'
                                  ]
                },
            'Ipsec-Base': {
                  'classes': [],
                  'ldapname': 'ipsecBase',
                  'attributes': [
                                    'Ipsec-Data',
                                    'Ipsec-Data-Type',
                                    'Ipsec-ID',
                                    'Ipsec-Name',
                                    'Ipsec-Owners-Reference'
                                  ]
                },
            'ms-TPM-Information-Objects-Container': {
                  'classes': [],
                  'ldapname': 'msTPM-InformationObjectsContainer',
                  'attributes': [
                                    'Common-Name'
                                  ]
                },
            'ms-WMI-StringSetParam': {
                  'classes': [],
                  'ldapname': 'msWMI-StringSetParam',
                  'attributes': [
                                    'ms-WMI-stringDefault',
                                    'ms-WMI-stringValidValues'
                                  ]
                },
            'ms-PKI-Key-Recovery-Agent': {
                  'classes': [],
                  'ldapname': 'msPKI-Key-Recovery-Agent',
                  'attributes': []
                },
            'ms-DS-Az-Task': {
                  'classes': [],
                  'ldapname': 'msDS-AzTask',
                  'attributes': [
                                    'Description',
                                    'ms-DS-Az-Application-Data',
                                    'ms-DS-Az-Biz-Rule',
                                    'ms-DS-Az-Biz-Rule-Language',
                                    'ms-DS-Az-Generic-Data',
                                    'ms-DS-Az-Last-Imported-Biz-Rule-Path',
                                    'ms-DS-Az-Object-Guid',
                                    'ms-DS-Az-Task-Is-Role-Definition',
                                    'ms-DS-Operations-For-Az-Task',
                                    'ms-DS-Tasks-For-Az-Task'
                                  ]
                },
            'ms-DFSR-GlobalSettings': {
                  'classes': [],
                  'ldapname': 'msDFSR-GlobalSettings',
                  'attributes': [
                                    'ms-DFSR-Extension',
                                    'ms-DFSR-Flags',
                                    'ms-DFSR-Options',
                                    'ms-DFSR-Options2'
                                  ]
                },
            'NTDS-Service': {
                  'classes': [],
                  'ldapname': 'nTDSService',
                  'attributes': [
                                    'DS-Heuristics',
                                    'Garbage-Coll-Period',
                                    'Repl-Topology-Stay-Of-Execution',
                                    'SPN-Mappings',
                                    'Tombstone-Lifetime',
                                    'ms-DS-Deleted-Object-Lifetime',
                                    'ms-DS-Other-Settings'
                                  ]
                },
            'Address-Template': {
                  'classes': [],
                  'ldapname': 'addressTemplate',
                  'attributes': [
                                    'Address-Syntax',
                                    'Address-Type',
                                    'Display-Name',
                                    'Per-Msg-Dialog-Display-Table',
                                    'Per-Recip-Dialog-Display-Table',
                                    'Proxy-Generation-Enabled'
                                  ]
                },
            'ms-Exch-Configuration-Container': {
                  'classes': [],
                  'ldapname': 'msExchConfigurationContainer',
                  'attributes': [
                                    'Address-Book-Roots',
                                    'Address-Book-Roots2',
                                    'Global-Address-List',
                                    'Global-Address-List2',
                                    'Template-Roots',
                                    'Template-Roots2'
                                  ]
                },
            'nisNetgroup': {
                  'classes': [],
                  'ldapname': 'nisNetgroup',
                  'attributes': [
                                    'Common-Name',
                                    'Description',
                                    'memberNisNetgroup',
                                    'msSFU-30-Name',
                                    'msSFU-30-Netgroup-Host-At-Domain',
                                    'msSFU-30-Netgroup-User-At-Domain',
                                    'msSFU-30-Nis-Domain',
                                    'nisMapName',
                                    'nisNetgroupTriple'
                                  ]
                },
            'ms-DS-Password-Settings-Container': {
                  'classes': [],
                  'ldapname': 'msDS-PasswordSettingsContainer',
                  'attributes': []
                },
            'rFC822LocalPart': {
                  'classes': [],
                  'ldapname': 'rFC822LocalPart',
                  'attributes': [
                                    'Common-Name',
                                    'Description',
                                    'Destination-Indicator',
                                    'Facsimile-Telephone-Number',
                                    'International-ISDN-Number',
                                    'Physical-Delivery-Office-Name',
                                    'Post-Office-Box',
                                    'Postal-Address',
                                    'Postal-Code',
                                    'Preferred-Delivery-Method',
                                    'Registered-Address',
                                    'See-Also',
                                    'Street-Address',
                                    'Surname',
                                    'Telephone-Number',
                                    'Teletex-Terminal-Identifier',
                                    'Telex-Number',
                                    'X121-Address'
                                  ]
                },
            'ms-DS-Claim-Types': {
                  'classes': [],
                  'ldapname': 'msDS-ClaimTypes',
                  'attributes': []
                },
            'Remote-Storage-Service-Point': {
                  'classes': [],
                  'ldapname': 'remoteStorageServicePoint',
                  'attributes': [
                                    'Remote-Storage-GUID'
                                  ]
                },
            'Sam-Domain': {
                  'classes': [
                                 'Sam-Domain-Base'
                               ],
                  'ldapname': 'samDomain',
                  'attributes': [
                                    'Auditing-Policy',
                                    'Builtin-Creation-Time',
                                    'Builtin-Modified-Count',
                                    'CA-Certificate',
                                    'Control-Access-Rights',
                                    'Creation-Time',
                                    'Default-Local-Policy-Object',
                                    'Description',
                                    'Desktop-Profile',
                                    'Domain-Policy-Object',
                                    'EFSPolicy',
                                    'GP-Link',
                                    'GP-Options',
                                    'LSA-Creation-Time',
                                    'LSA-Modified-Count',
                                    'Lock-Out-Observation-Window',
                                    'Lockout-Duration',
                                    'Lockout-Threshold',
                                    'MS-DS-All-Users-Trust-Quota',
                                    'MS-DS-Machine-Account-Quota',
                                    'MS-DS-Per-User-Trust-Quota',
                                    'MS-DS-Per-User-Trust-Tombstones-Quota',
                                    'Max-Pwd-Age',
                                    'Min-Pwd-Age',
                                    'Min-Pwd-Length',
                                    'Modified-Count-At-Last-Prom',
                                    'NETBIOS-Name',
                                    'NT-Mixed-Domain',
                                    'Next-Rid',
                                    'Pek-Key-Change-Interval',
                                    'Pek-List',
                                    'Private-Key',
                                    'Pwd-History-Length',
                                    'Pwd-Properties',
                                    'RID-Manager-Reference',
                                    'Replica-Source',
                                    'Tree-Name',
                                    'ms-DS-Logon-Time-Sync-Interval'
                                  ]
                },
            'Licensing-Site-Settings': {
                  'classes': [],
                  'ldapname': 'licensingSiteSettings',
                  'attributes': [
                                    'Site-Server'
                                  ]
                },
            'NTFRS-Subscriptions': {
                  'classes': [],
                  'ldapname': 'nTFRSSubscriptions',
                  'attributes': [
                                    'Computer',
                                    'FRS-Extensions',
                                    'FRS-Version',
                                    'FRS-Working-Path'
                                  ]
                },
            'ms-DS-Az-Admin-Manager': {
                  'classes': [],
                  'ldapname': 'msDS-AzAdminManager',
                  'attributes': [
                                    'Description',
                                    'ms-DS-Az-Application-Data',
                                    'ms-DS-Az-Domain-Timeout',
                                    'ms-DS-Az-Generate-Audits',
                                    'ms-DS-Az-Generic-Data',
                                    'ms-DS-Az-Major-Version',
                                    'ms-DS-Az-Minor-Version',
                                    'ms-DS-Az-Object-Guid',
                                    'ms-DS-Az-Script-Engine-Cache-Max',
                                    'ms-DS-Az-Script-Timeout'
                                  ]
                },
            'ACS-Policy': {
                  'classes': [],
                  'ldapname': 'aCSPolicy',
                  'attributes': [
                                    'ACS-Aggregate-Token-Rate-Per-User',
                                    'ACS-Direction',
                                    'ACS-Identity-Name',
                                    'ACS-Max-Aggregate-Peak-Rate-Per-User',
                                    'ACS-Max-Duration-Per-Flow',
                                    'ACS-Max-Peak-Bandwidth-Per-Flow',
                                    'ACS-Max-Token-Bucket-Per-Flow',
                                    'ACS-Max-Token-Rate-Per-Flow',
                                    'ACS-Maximum-SDU-Size',
                                    'ACS-Minimum-Delay-Variation',
                                    'ACS-Minimum-Latency',
                                    'ACS-Minimum-Policed-Size',
                                    'ACS-Permission-Bits',
                                    'ACS-Priority',
                                    'ACS-Service-Type',
                                    'ACS-Time-Of-Day',
                                    'ACS-Total-No-Of-Flows'
                                  ]
                },
            'Category-Registration': {
                  'classes': [],
                  'ldapname': 'categoryRegistration',
                  'attributes': [
                                    'Category-Id',
                                    'Locale-ID',
                                    'Localized-Description',
                                    'Managed-By'
                                  ]
                },
            'Query-Policy': {
                  'classes': [],
                  'ldapname': 'queryPolicy',
                  'attributes': [
                                    'LDAP-Admin-Limits',
                                    'LDAP-IPDeny-List'
                                  ]
                },
            'domainRelatedObject': {
                  'classes': [],
                  'ldapname': 'domainRelatedObject',
                  'attributes': [
                                    'associatedDomain'
                                  ]
                },
            'RRAS-Administration-Dictionary': {
                  'classes': [],
                  'ldapname': 'rRASAdministrationDictionary',
                  'attributes': [
                                    'ms-RRAS-Vendor-Attribute-Entry'
                                  ]
                },
            'ms-DFS-Namespace-Anchor': {
                  'classes': [],
                  'ldapname': 'msDFS-NamespaceAnchor',
                  'attributes': [
                                    'ms-DFS-Schema-Major-Version'
                                  ]
                },
            'ms-WMI-RealRangeParam': {
                  'classes': [],
                  'ldapname': 'msWMI-RealRangeParam',
                  'attributes': [
                                    'ms-WMI-int8Default',
                                    'ms-WMI-int8Max',
                                    'ms-WMI-int8Min'
                                  ]
                },
            'Address-Book-Container': {
                  'classes': [],
                  'ldapname': 'addressBookContainer',
                  'attributes': [
                                    'Configuration',
                                    'Display-Name',
                                    'Purported-Search'
                                  ]
                },
            'ms-ieee-80211-Policy': {
                  'classes': [],
                  'ldapname': 'msieee80211-Policy',
                  'attributes': [
                                    'ms-ieee-80211-Data',
                                    'ms-ieee-80211-Data-Type',
                                    'ms-ieee-80211-ID'
                                  ]
                },
            'Dns-Zone': {
                  'classes': [],
                  'ldapname': 'dnsZone',
                  'attributes': [
                                    'DNS-Property',
                                    'Dns-Allow-Dynamic',
                                    'Dns-Allow-XFR',
                                    'Dns-Notify-Secondaries',
                                    'Dns-Secure-Secondaries',
                                    'Domain-Component',
                                    'Managed-By',
                                    'ms-DNS-DNSKEY-Record-Set-TTL',
                                    'ms-DNS-DNSKEY-Records',
                                    'ms-DNS-DS-Record-Algorithms',
                                    'ms-DNS-DS-Record-Set-TTL',
                                    'ms-DNS-Is-Signed',
                                    'ms-DNS-Maintain-Trust-Anchor',
                                    'ms-DNS-NSEC3-Current-Salt',
                                    'ms-DNS-NSEC3-Hash-Algorithm',
                                    'ms-DNS-NSEC3-Iterations',
                                    'ms-DNS-NSEC3-OptOut',
                                    'ms-DNS-NSEC3-Random-Salt-Length',
                                    'ms-DNS-NSEC3-User-Salt',
                                    'ms-DNS-Parent-Has-Secure-Delegation',
                                    'ms-DNS-Propagation-Time',
                                    'ms-DNS-RFC5011-Key-Rollovers',
                                    'ms-DNS-Secure-Delegation-Polling-Period',
                                    'ms-DNS-Sign-With-NSEC3',
                                    'ms-DNS-Signature-Inception-Offset',
                                    'ms-DNS-Signing-Key-Descriptors',
                                    'ms-DNS-Signing-Keys'
                                  ]
                },
            'RID-Manager': {
                  'classes': [],
                  'ldapname': 'rIDManager',
                  'attributes': [
                                    'RID-Available-Pool'
                                  ]
                },
            'ms-WMI-ObjectEncoding': {
                  'classes': [],
                  'ldapname': 'msWMI-ObjectEncoding',
                  'attributes': [
                                    'ms-WMI-Class',
                                    'ms-WMI-Genus',
                                    'ms-WMI-ID',
                                    'ms-WMI-Parm1',
                                    'ms-WMI-Parm2',
                                    'ms-WMI-Parm3',
                                    'ms-WMI-Parm4',
                                    'ms-WMI-ScopeGuid',
                                    'ms-WMI-TargetObject',
                                    'ms-WMI-intFlags1',
                                    'ms-WMI-intFlags2',
                                    'ms-WMI-intFlags3',
                                    'ms-WMI-intFlags4'
                                  ]
                },
            'account': {
                  'classes': [],
                  'ldapname': 'account',
                  'attributes': [
                                    'Description',
                                    'Locality-Name',
                                    'Organization-Name',
                                    'Organizational-Unit-Name',
                                    'See-Also',
                                    'host',
                                    'uid'
                                  ]
                },
            'ACS-Subnet': {
                  'classes': [],
                  'ldapname': 'aCSSubnet',
                  'attributes': [
                                    'ACS-Allocable-RSVP-Bandwidth',
                                    'ACS-Cache-Timeout',
                                    'ACS-DSBM-DeadTime',
                                    'ACS-DSBM-Priority',
                                    'ACS-DSBM-Refresh',
                                    'ACS-Enable-ACS-Service',
                                    'ACS-Enable-RSVP-Accounting',
                                    'ACS-Enable-RSVP-Message-Logging',
                                    'ACS-Event-Log-Level',
                                    'ACS-Max-Duration-Per-Flow',
                                    'ACS-Max-No-Of-Account-Files',
                                    'ACS-Max-No-Of-Log-Files',
                                    'ACS-Max-Peak-Bandwidth',
                                    'ACS-Max-Peak-Bandwidth-Per-Flow',
                                    'ACS-Max-Size-Of-RSVP-Account-File',
                                    'ACS-Max-Size-Of-RSVP-Log-File',
                                    'ACS-Max-Token-Rate-Per-Flow',
                                    'ACS-Non-Reserved-Max-SDU-Size',
                                    'ACS-Non-Reserved-Min-Policed-Size',
                                    'ACS-Non-Reserved-Peak-Rate',
                                    'ACS-Non-Reserved-Token-Size',
                                    'ACS-Non-Reserved-Tx-Limit',
                                    'ACS-Non-Reserved-Tx-Size',
                                    'ACS-RSVP-Account-Files-Location',
                                    'ACS-RSVP-Log-Files-Location',
                                    'ACS-Server-List'
                                  ]
                },
            'Service-Instance': {
                  'classes': [],
                  'ldapname': 'serviceInstance',
                  'attributes': [
                                    'Display-Name',
                                    'Service-Class-ID',
                                    'Service-Instance-Version',
                                    'Winsock-Addresses'
                                  ]
                },
            'msSFU-30-Net-Id': {
                  'classes': [],
                  'ldapname': 'msSFU30NetId',
                  'attributes': [
                                    'msSFU-30-Key-Values',
                                    'msSFU-30-Name',
                                    'msSFU-30-Nis-Domain',
                                    'nisMapName'
                                  ]
                },
            'Inter-Site-Transport-Container': {
                  'classes': [],
                  'ldapname': 'interSiteTransportContainer',
                  'attributes': []
                },
            'Ipsec-Policy': {
                  'classes': [],
                  'ldapname': 'ipsecPolicy',
                  'attributes': [
                                    'Ipsec-ISAKMP-Reference',
                                    'Ipsec-NFA-Reference'
                                  ]
                },
            'Meeting': {
                  'classes': [],
                  'ldapname': 'meeting',
                  'attributes': [
                                    'meetingAdvertiseScope',
                                    'meetingApplication',
                                    'meetingBandwidth',
                                    'meetingBlob',
                                    'meetingContactInfo',
                                    'meetingDescription',
                                    'meetingEndTime',
                                    'meetingID',
                                    'meetingIP',
                                    'meetingIsEncrypted',
                                    'meetingKeyword',
                                    'meetingLanguage',
                                    'meetingLocation',
                                    'meetingMaxParticipants',
                                    'meetingName',
                                    'meetingOriginator',
                                    'meetingOwner',
                                    'meetingProtocol',
                                    'meetingRating',
                                    'meetingRecurrence',
                                    'meetingScope',
                                    'meetingStartTime',
                                    'meetingType',
                                    'meetingURL'
                                  ]
                },
            'nisMap': {
                  'classes': [],
                  'ldapname': 'nisMap',
                  'attributes': [
                                    'Common-Name',
                                    'Description',
                                    'nisMapName'
                                  ]
                }
        },

        
        /**
         * Knowledge for the Active Directory Schema - LDAP Mapping
         * 
         * See http://msdn.microsoft.com/en-us/library/windows/desktop/ms680938%28v=vs.85%29.aspx
         * 
         * Each class in LDAP has two names - an LDAP-Class-Name and a CN.  This mapping converts
         * from the LDAP-Class-Name to the CN.  The adSchemaClasses mapping converts the other
         * way.
         * 
         * The content is generated by get-ad-classes.pl from the MSDN website
         */
        adLDAPClasses: {
            'aCSPolicy':    'ACS-Policy',
            'aCSResourceLimits':    'ACS-Resource-Limits',
            'aCSSubnet':    'ACS-Subnet',
            'account':  'account',
            'addressBookContainer': 'Address-Book-Container',
            'addressTemplate':  'Address-Template',
            'applicationEntity':    'Application-Entity',
            'applicationProcess':   'Application-Process',
            'applicationSettings':  'Application-Settings',
            'applicationSiteSettings':  'Application-Site-Settings',
            'applicationVersion':   'Application-Version',
            'attributeSchema':  'Attribute-Schema',
            'bootableDevice':   'bootableDevice',
            'builtinDomain':    'Builtin-Domain',
            'cRLDistributionPoint': 'CRL-Distribution-Point',
            'categoryRegistration': 'Category-Registration',
            'certificationAuthority':   'Certification-Authority',
            'classRegistration':    'Class-Registration',
            'classSchema':  'Class-Schema',
            'classStore':   'Class-Store',
            'comConnectionPoint':   'Com-Connection-Point',
            'computer': 'Computer',
            'configuration':    'Configuration',
            'connectionPoint':  'Connection-Point',
            'contact':  'Contact',
            'container':    'Container',
            'controlAccessRight':   'Control-Access-Right',
            'country':  'Country',
            'crossRef': 'Cross-Ref',
            'crossRefContainer':    'Cross-Ref-Container',
            'dHCPClass':    'DHCP-Class',
            'dMD':  'DMD',
            'dSA':  'DSA',
            'dSUISettings': 'DS-UI-Settings',
            'device':   'Device',
            'dfsConfiguration': 'Dfs-Configuration',
            'displaySpecifier': 'Display-Specifier',
            'displayTemplate':  'Display-Template',
            'dnsNode':  'Dns-Node',
            'dnsZone':  'Dns-Zone',
            'document': 'document',
            'documentSeries':   'documentSeries',
            'domain':   'Domain',
            'domainDNS':    'Domain-DNS',
            'domainPolicy': 'Domain-Policy',
            'domainRelatedObject':  'domainRelatedObject',
            'dynamicObject':    'Dynamic-Object',
            'fTDfs':    'FT-Dfs',
            'fileLinkTracking': 'File-Link-Tracking',
            'fileLinkTrackingEntry':    'File-Link-Tracking-Entry',
            'foreignSecurityPrincipal': 'Foreign-Security-Principal',
            'friendlyCountry':  'friendlyCountry',
            'group':    'Group',
            'groupOfNames': 'Group-Of-Names',
            'groupOfUniqueNames':   'groupOfUniqueNames',
            'groupPolicyContainer': 'Group-Policy-Container',
            'ieee802Device':    'ieee802Device',
            'indexServerCatalog':   'Index-Server-Catalog',
            'inetOrgPerson':    'inetOrgPerson',
            'infrastructureUpdate': 'Infrastructure-Update',
            'intellimirrorGroup':   'Intellimirror-Group',
            'intellimirrorSCP': 'Intellimirror-SCP',
            'interSiteTransport':   'Inter-Site-Transport',
            'interSiteTransportContainer':  'Inter-Site-Transport-Container',
            'ipHost':   'ipHost',
            'ipNetwork':    'ipNetwork',
            'ipProtocol':   'ipProtocol',
            'ipService':    'ipService',
            'ipsecBase':    'Ipsec-Base',
            'ipsecFilter':  'Ipsec-Filter',
            'ipsecISAKMPPolicy':    'Ipsec-ISAKMP-Policy',
            'ipsecNFA': 'Ipsec-NFA',
            'ipsecNegotiationPolicy':   'Ipsec-Negotiation-Policy',
            'ipsecPolicy':  'Ipsec-Policy',
            'leaf': 'Leaf',
            'licensingSiteSettings':    'Licensing-Site-Settings',
            'linkTrackOMTEntry':    'Link-Track-OMT-Entry',
            'linkTrackObjectMoveTable': 'Link-Track-Object-Move-Table',
            'linkTrackVolEntry':    'Link-Track-Vol-Entry',
            'linkTrackVolumeTable': 'Link-Track-Volume-Table',
            'locality': 'Locality',
            'lostAndFound': 'Lost-And-Found',
            'mS-SQL-OLAPCube':  'MS-SQL-OLAPCube',
            'mS-SQL-OLAPDatabase':  'MS-SQL-OLAPDatabase',
            'mS-SQL-OLAPServer':    'MS-SQL-OLAPServer',
            'mS-SQL-SQLDatabase':   'MS-SQL-SQLDatabase',
            'mS-SQL-SQLPublication':    'MS-SQL-SQLPublication',
            'mS-SQL-SQLRepository': 'MS-SQL-SQLRepository',
            'mS-SQL-SQLServer': 'MS-SQL-SQLServer',
            'mSMQConfiguration':    'MSMQ-Configuration',
            'mSMQEnterpriseSettings':   'MSMQ-Enterprise-Settings',
            'mSMQMigratedUser': 'MSMQ-Migrated-User',
            'mSMQQueue':    'MSMQ-Queue',
            'mSMQSettings': 'MSMQ-Settings',
            'mSMQSiteLink': 'MSMQ-Site-Link',
            'mailRecipient':    'Mail-Recipient',
            'meeting':  'Meeting',
            'ms-net-ieee-80211-GroupPolicy':    'ms-net-ieee-80211-GroupPolicy',
            'ms-net-ieee-8023-GroupPolicy': 'ms-net-ieee-8023-GroupPolicy',
            'msAuthz-CentralAccessPolicies':    'ms-Authz-Central-Access-Policies',
            'msAuthz-CentralAccessPolicy':  'ms-Authz-Central-Access-Policy',
            'msAuthz-CentralAccessRule':    'ms-Authz-Central-Access-Rule',
            'msAuthz-CentralAccessRules':   'ms-Authz-Central-Access-Rules',
            'msCOM-Partition':  'ms-COM-Partition',
            'msCOM-PartitionSet':   'ms-COM-PartitionSet',
            'msDFS-DeletedLinkv2':  'ms-DFS-Deleted-Link-v2',
            'msDFS-Linkv2': 'ms-DFS-Link-v2',
            'msDFS-NamespaceAnchor':    'ms-DFS-Namespace-Anchor',
            'msDFS-Namespacev2':    'ms-DFS-Namespace-v2',
            'msDFSR-Connection':    'ms-DFSR-Connection',
            'msDFSR-Content':   'ms-DFSR-Content',
            'msDFSR-ContentSet':    'ms-DFSR-ContentSet',
            'msDFSR-GlobalSettings':    'ms-DFSR-GlobalSettings',
            'msDFSR-LocalSettings': 'ms-DFSR-LocalSettings',
            'msDFSR-Member':    'ms-DFSR-Member',
            'msDFSR-ReplicationGroup':  'ms-DFSR-ReplicationGroup',
            'msDFSR-Subscriber':    'ms-DFSR-Subscriber',
            'msDFSR-Subscription':  'ms-DFSR-Subscription',
            'msDFSR-Topology':  'ms-DFSR-Topology',
            'msDNS-ServerSettings': 'ms-DNS-Server-Settings',
            'msDS-App-Configuration':   'ms-DS-App-Configuration',
            'msDS-AppData': 'ms-DS-App-Data',
            'msDS-AzAdminManager':  'ms-DS-Az-Admin-Manager',
            'msDS-AzApplication':   'ms-DS-Az-Application',
            'msDS-AzOperation': 'ms-DS-Az-Operation',
            'msDS-AzRole':  'ms-DS-Az-Role',
            'msDS-AzScope': 'ms-DS-Az-Scope',
            'msDS-AzTask':  'ms-DS-Az-Task',
            'msDS-BindProxy':   'ms-DS-Bind-Proxy',
            'msDS-BindableObject':  'ms-DS-Bindable-Object',
            'msDS-ClaimType':   'ms-DS-Claim-Type',
            'msDS-ClaimTypePropertyBase':   'ms-DS-Claim-Type-Property-Base',
            'msDS-ClaimTypes':  'ms-DS-Claim-Types',
            'msDS-ClaimsTransformationPolicies':    'ms-DS-Claims-Transformation-Policies',
            'msDS-ClaimsTransformationPolicyType':  'ms-DS-Claims-Transformation-Policy-Type',
            'msDS-GroupManagedServiceAccount':  'ms-DS-Group-Managed-Service-Account',
            'msDS-ManagedServiceAccount':   'ms-DS-Managed-Service-Account',
            'msDS-OptionalFeature': 'ms-DS-Optional-Feature',
            'msDS-PasswordSettings':    'ms-DS-Password-Settings',
            'msDS-PasswordSettingsContainer':   'ms-DS-Password-Settings-Container',
            'msDS-QuotaContainer':  'ms-DS-Quota-Container',
            'msDS-QuotaControl':    'ms-DS-Quota-Control',
            'msDS-ResourceProperties':  'ms-DS-Resource-Properties',
            'msDS-ResourceProperty':    'ms-DS-Resource-Property',
            'msDS-ResourcePropertyList':    'ms-DS-Resource-Property-List',
            'msDS-ServiceConnectionPointPublicationService':    'ms-DS-Service-Connection-Point-Publication-Service',
            'msDS-ValueType':   'ms-DS-Value-Type',
            'msExchConfigurationContainer': 'ms-Exch-Configuration-Container',
            'msFVE-RecoveryInformation':    'ms-FVE-RecoveryInformation',
            'msImaging-PSPs':   'ms-Imaging-PSPs',
            'msImaging-PostScanProcess':    'ms-Imaging-PostScanProcess',
            'msKds-ProvRootKey':    'ms-Kds-Prov-RootKey',
            'msKds-ProvServerConfiguration':    'ms-Kds-Prov-ServerConfiguration',
            'msMQ-Custom-Recipient':    'MSMQ-Custom-Recipient',
            'msMQ-Group':   'MSMQ-Group',
            'msPKI-Enterprise-Oid': 'ms-PKI-Enterprise-Oid',
            'msPKI-Key-Recovery-Agent': 'ms-PKI-Key-Recovery-Agent',
            'msPKI-PrivateKeyRecoveryAgent':    'ms-PKI-Private-Key-Recovery-Agent',
            'msPrint-ConnectionPolicy': 'ms-Print-ConnectionPolicy',
            'msSFU30DomainInfo':    'msSFU-30-Domain-Info',
            'msSFU30MailAliases':   'msSFU-30-Mail-Aliases',
            'msSFU30NISMapConfig':  'msSFU-30-NIS-Map-Config',
            'msSFU30NetId': 'msSFU-30-Net-Id',
            'msSFU30NetworkUser':   'msSFU-30-Network-User',
            'msSPP-ActivationObject':   'ms-SPP-Activation-Object',
            'msSPP-ActivationObjectsContainer': 'ms-SPP-Activation-Objects-Container',
            'msTAPI-RtConference':  'ms-TAPI-Rt-Conference',
            'msTAPI-RtPerson':  'ms-TAPI-Rt-Person',
            'msTPM-InformationObject':  'ms-TPM-Information-Object',
            'msTPM-InformationObjectsContainer':    'ms-TPM-Information-Objects-Container',
            'msWMI-IntRangeParam':  'ms-WMI-IntRangeParam',
            'msWMI-IntSetParam':    'ms-WMI-IntSetParam',
            'msWMI-MergeablePolicyTemplate':    'ms-WMI-MergeablePolicyTemplate',
            'msWMI-ObjectEncoding': 'ms-WMI-ObjectEncoding',
            'msWMI-PolicyTemplate': 'ms-WMI-PolicyTemplate',
            'msWMI-PolicyType': 'ms-WMI-PolicyType',
            'msWMI-RangeParam': 'ms-WMI-RangeParam',
            'msWMI-RealRangeParam': 'ms-WMI-RealRangeParam',
            'msWMI-Rule':   'ms-WMI-Rule',
            'msWMI-ShadowObject':   'ms-WMI-ShadowObject',
            'msWMI-SimplePolicyTemplate':   'ms-WMI-SimplePolicyTemplate',
            'msWMI-Som':    'ms-WMI-Som',
            'msWMI-StringSetParam': 'ms-WMI-StringSetParam',
            'msWMI-UintRangeParam': 'ms-WMI-UintRangeParam',
            'msWMI-UintSetParam':   'ms-WMI-UintSetParam',
            'msWMI-UnknownRangeParam':  'ms-WMI-UnknownRangeParam',
            'msWMI-WMIGPO': 'ms-WMI-WMIGPO',
            'msieee80211-Policy':   'ms-ieee-80211-Policy',
            'nTDSConnection':   'NTDS-Connection',
            'nTDSDSA':  'NTDS-DSA',
            'nTDSDSARO':    'NTDS-DSA-RO',
            'nTDSService':  'NTDS-Service',
            'nTDSSiteSettings': 'NTDS-Site-Settings',
            'nTFRSMember':  'NTFRS-Member',
            'nTFRSReplicaSet':  'NTFRS-Replica-Set',
            'nTFRSSettings':    'NTFRS-Settings',
            'nTFRSSubscriber':  'NTFRS-Subscriber',
            'nTFRSSubscriptions':   'NTFRS-Subscriptions',
            'nisMap':   'nisMap',
            'nisNetgroup':  'nisNetgroup',
            'nisObject':    'nisObject',
            'oncRpc':   'oncRpc',
            'organization': 'Organization',
            'organizationalPerson': 'Organizational-Person',
            'organizationalRole':   'Organizational-Role',
            'organizationalUnit':   'Organizational-Unit',
            'pKICertificateTemplate':   'PKI-Certificate-Template',
            'pKIEnrollmentService': 'PKI-Enrollment-Service',
            'packageRegistration':  'Package-Registration',
            'person':   'Person',
            'physicalLocation': 'Physical-Location',
            'posixAccount': 'posixAccount',
            'posixGroup':   'posixGroup',
            'printQueue':   'Print-Queue',
            'queryPolicy':  'Query-Policy',
            'rFC822LocalPart':  'rFC822LocalPart',
            'rIDManager':   'RID-Manager',
            'rIDSet':   'RID-Set',
            'rRASAdministrationConnectionPoint':    'RRAS-Administration-Connection-Point',
            'rRASAdministrationDictionary': 'RRAS-Administration-Dictionary',
            'remoteMailRecipient':  'Remote-Mail-Recipient',
            'remoteStorageServicePoint':    'Remote-Storage-Service-Point',
            'residentialPerson':    'Residential-Person',
            'room': 'room',
            'rpcContainer': 'Rpc-Container',
            'rpcEntry': 'rpc-Entry',
            'rpcGroup': 'rpc-Group',
            'rpcProfile':   'rpc-Profile',
            'rpcProfileElement':    'rpc-Profile-Element',
            'rpcServer':    'rpc-Server',
            'rpcServerElement': 'rpc-Server-Element',
            'samDomain':    'Sam-Domain',
            'samDomainBase':    'Sam-Domain-Base',
            'samServer':    'Sam-Server',
            'secret':   'Secret',
            'securityObject':   'Security-Object',
            'securityPrincipal':    'Security-Principal',
            'server':   'Server',
            'serversContainer': 'Servers-Container',
            'serviceAdministrationPoint':   'Service-Administration-Point',
            'serviceClass': 'Service-Class',
            'serviceConnectionPoint':   'Service-Connection-Point',
            'serviceInstance':  'Service-Instance',
            'shadowAccount':    'shadowAccount',
            'simpleSecurityObject': 'simpleSecurityObject',
            'site': 'Site',
            'siteLink': 'Site-Link',
            'siteLinkBridge':   'Site-Link-Bridge',
            'sitesContainer':   'Sites-Container',
            'storage':  'Storage',
            'subSchema':    'SubSchema',
            'subnet':   'Subnet',
            'subnetContainer':  'Subnet-Container',
            'top':  'Top',
            'trustedDomain':    'Trusted-Domain',
            'typeLibrary':  'Type-Library',
            'user': 'User',
            'volume':   'Volume'
        }


    });
    return LDAPRecordView;
});