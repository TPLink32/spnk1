/**
 * Created by peter on 6/5/15.
 */


define(
    [
        'module',
        'underscore',
        'views/Base'
    ],
    function (module,
              _,
              BaseView) {

        var breadcrumbs = {
            'root': _('Settings').t(),
            'page': {
                'aws_config': _('CloudConfig Inputs').t(),
                'aws_cloudtrail': _('CloudTrail Inputs').t(),
                'aws_cloudwatch': _('CloudWatch Inputs').t(),
                'aws_billing': _('CloudBilling Inputs').t()
            },
            'new': {
                'aws_config': _('CloudConfig New Input').t(),
                'aws_cloudtrail': _('CloudTrail New Input').t(),
                'aws_cloudwatch': _('CloudWatch New Input').t(),
                'aws_billing': _('CloudBilling New Input').t()
            },
            'edit': {
                'aws_config': _('CloudConfig Edit Input').t(),
                'aws_cloudtrail': _('CloudTrail Edit Input').t(),
                'aws_cloudwatch': _('CloudWatch Edit Input').t(),
                'aws_billing': _('CloudBilling Edit Input').t()
            }
        };

        return BaseView.extend({
            moduleId: module.id,
            initialize: function () {
                BaseView.prototype.initialize.apply(this, arguments);
                this.listenTo(this.model.navigator, 'change:url', this.render);
            },
            render: function () {
                var aws_service = this.model.navigator.get('aws_service');
                this.service = breadcrumbs.page[aws_service] ? aws_service : null;
                this.action = this.model.navigator.get('action');
                this.name = this.model.navigator.get('name');

                var title = breadcrumbs.root;
                var namePath = null;
                if (this.action == 'create') {
                    title = breadcrumbs.new[this.service];
                    namePath = title;
                }
                else if (this.action == 'edit' && this.name) {
                    title = breadcrumbs.edit[this.service];
                    namePath = title;
                }
                else if (this.service) {
                    title = breadcrumbs.page[this.service];
                }

                var root = {
                    label: breadcrumbs.root
                };

                var servicePath = this.service ? {
                    label: breadcrumbs.page[this.service],
                    id: this.service
                } : null;

                var template = this.compiledTemplate({
                    title: title,
                    root: root,
                    servicePath: servicePath,
                    namePath: namePath
                });
                this.$el.html(template);

                if (this.service) {
                    var $root = this.$el.find('.nav-path-root')
                    $root.off('click');
                    $root.on('click', this.clickRoot.bind(this));
                }

                if (namePath) {
                    var $service = this.$el.find('.nav-path-service')
                    $service.off();
                    $service.on('click', this.clickService.bind(this));
                }
                return this;
            },
            clickRoot: function () {
                this.model.navigator.navigateToRoot();
            },
            clickService: function () {
                this.model.navigator.navigateToPage(this.service);
            },
            template: '\
                <div class="aws-page-header">\
                    <div class="title"><%= title %></div>\
                    <div class="nav-paths">\
                        <% if (root) { %>\
                            <% if (servicePath) { %>\
                                <a class="nav-path nav-path-root"><%= root.label %></a>\
                                <span class="nav-path-deco">&raquo;</span>\
                                <a class="nav-path nav-path-service"><%= servicePath.label %></a>\
                                <% if (namePath) { %>\
                                    <span class="nav-path-deco">&raquo;</span>\
                                    <a class="nav-path nav-path-name"><%= namePath %></a>\
                                <% } %>\
                            <% } else { %>\
                                <a class="nav-path nav-path-root"><%= root.label %></a>\
                            <% } %>\
                        <% } %>\
                    </div>\
                </div>\
                '
        });
    });






