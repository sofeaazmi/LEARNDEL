/**
 * Customised from https://github.com/givanz/VvvebJs
 */

CustomBuilder = {
    saveUrl : '',
    previewUrl : '',
    contextPath : '/jw',
    appId: '',
    appVersion: '',
    appPath: '',
    builderType: '',
    builderLabel: '',
    defaultBuilder: false,
    id: '',
    config: {
        builder : {
            options : {
                getDefinitionUrl : ""
            },
            callbacks : {
                initBuilder : "",
                load : "",
                saveEditProperties : "",
                cancelEditProperties : "",
                getBuilderProperties : "",
                saveBuilderProperties : ""
            }
        },
        advanced_tools : {
            tree_viewer : {
                disabled : false,
                childs_properties : ["elements"],
                matchers : {
                    'editable' : {
                        match : function (viewer, deferreds, node, jsonObj, refObj) {
                            if (node.data['parent'] === undefined) {
                                DependencyTree.Util.createEditIndicator(viewer, node, function(){
                                    CustomBuilder.showPopUpBuilderProperties();
                                });
                            } else if (jsonObj['className'] !== undefined) {
                                DependencyTree.Util.createEditIndicator(viewer, node, function() {
                                    CustomBuilder.editProperties(jsonObj["className"], jsonObj["properties"]);
                                });
                            }   

                            return false;
                        }
                    }
                }
            },
            xray : {
                 disabled : true
            },
            usage : {
                disabled : false
            },
            i18n : {
                disabled : false,
                keywords : [
                    "label"
                ]
            },
            permission : {
                disabled : false,
                permission_plugin : "org.joget.apps.form.model.FormPermission",
                authorized : {
                    property : "hidden",
                    default_value : "",
                    options : [
                        {
                            key : "visible",
                            value : "",
                            label : get_cbuilder_msg("ubuilder.visible")
                        },
                        {
                            key : "hidden",
                            value : "true",
                            label : get_cbuilder_msg("ubuilder.hidden")
                        }
                    ]
                },
                unauthorized : {
                    property : "",
                    default_value : "",
                    options : [
                        {
                            key : "visible",
                            value : "",
                            label : get_cbuilder_msg("ubuilder.visible")
                        },
                        {
                            key : "hidden",
                            value : "true",
                            label : get_cbuilder_msg("ubuilder.hidden")
                        }
                    ]
                },
                element_label_callback : "",
                element_support_plugin : [],
                display_element_id : false,
                childs_properties : ["elements"],
                ignore_classes : [],
                render_elements_callback : "",
                rules_properties_callback : ""
            },
            customTabsCallback : ""
        }
    },
    propertiesOptions: null,
    
    //undo & redo feature
    undoStack : new Array(),
    redoStack : new Array(),
    undoRedoMax : 50,
    
    json : null,
    data : {},
    paletteElements : {},
    availablePermission : {},
    
    //Tracker
    isCtrlKeyPressed : false,
    isAltKeyPressed : false,
    saveChecker : 0,
    
    navCreateNewDialog : null,
    
    /*
     * Utility method to call a function by name
     */
    callback : function(name, args) {
        if (name !== "" && name !== undefined && name !== null) {
            var func = PropertyEditor.Util.getFunction(name);
            if (func !== null && func !== undefined) {
                return func.apply(null, args);
            }
        }
    },
    
    /*
     * Used in cbuilder/base.jsp to setup the configuration of the builder 
     */
    initConfig : function (config) {
        CustomBuilder.config = $.extend(true, CustomBuilder.config, config);
    },
    
    /*
     * Used in cbuilder/base.jsp to setup the properties page of the builder 
     */
    initPropertiesOptions : function(options) {
        CustomBuilder.propertiesOptions = options;
    },
    
    /*
     * Used in cbuilder/base.jsp to initialize the builder
     */
    initBuilder: function (callback) {
        CustomBuilder.advancedToolsOptions = {
            contextPath : CustomBuilder.contextPath,
            appId : CustomBuilder.appId,
            appVersion : CustomBuilder.appVersion,
            id : CustomBuilder.id,
            builder : (CustomBuilder.builderType !== "form" && CustomBuilder.builderType !== "userview" && CustomBuilder.builderType !== "datalist")?"custom":CustomBuilder.builderType
        };
        
        
        if (!CustomBuilder.supportTreeViewer()) {
            $(".advanced-tools #treeviewer-btn").remove();
        }
        if (!CustomBuilder.supportXray()) {
            $(".advanced-tools #xray-btn").remove();
        }
        if (!CustomBuilder.supportI18n()) {
            $(".advanced-tools #i18n-btn").remove();
        }
        if (!CustomBuilder.supportUsage()) {
            $(".advanced-tools #usages-btn").remove();
        }
        if (!CustomBuilder.supportPermission()) {
            $(".advanced-tools #permission-btn").remove();
        }
        
        var builderCallback = function(){
            if (callback) {
                callback();
            }
            
            $("[data-cbuilder-action]").each(function () {
                var on = "click";
                var target = $(this);
                if (this.dataset.cbuilderOn)
                    on = this.dataset.cbuilderOn;
                
                var action = CustomBuilder[this.dataset.cbuilderAction];
                if (CustomBuilder.config.builder.callbacks[this.dataset.cbuilderAction] !== undefined && CustomBuilder.config.builder.callbacks[this.dataset.cbuilderAction] !== "") {
                    var func = PropertyEditor.Util.getFunction(CustomBuilder.config.builder.callbacks[this.dataset.cbuilderAction]);
                    if (func !== null && func !== undefined) {
                        action = func;
                    }
                }
                
                var buttonAction = function(event) {
                    if ($(target).is(":visible") && !$(target).hasClass("disabled")) {
                        action.call(this, event);
                    }
                };

                $(this).on(on, buttonAction);
                if (this.dataset.cbuilderShortcut)
                {
                    $(document).bind('keydown', this.dataset.cbuilderShortcut, buttonAction);
                    $(window.FrameDocument).bind('keydown', this.dataset.cbuilderShortcut, buttonAction);
                }
            });
            
            CustomBuilder.customAdvancedToolTabs();
            
            $(document).uitooltip();
            
            CustomBuilder.builderFavIcon();
            CustomBuilder.updateBuilderBasedOnSettings();
            
            CustomBuilder.initQuickNav();
        };
        
        CustomBuilder.callback(CustomBuilder.config.builder.callbacks["initBuilder"], [builderCallback]);
    },
    
    /*
     * Change the builder fav icon to the builder color
     */
    builderFavIcon : function() {
        setTimeout(function(){
            var faviconSize = 32;
            var canvas = document.createElement('canvas');
            canvas.width = faviconSize;
            canvas.height = faviconSize;

            var context = canvas.getContext('2d');
            context.fillStyle = CustomBuilder.builderColor;
            context.fillRect(0, 0, faviconSize, faviconSize);

            var img = new Image();
            img.onload = function() {
                context.drawImage(img, 4, 4, 24, 24);
                $("#favicon").attr("href",canvas.toDataURL('image/png'));
            }
            img.src = CustomBuilder.contextPath + "/builder/favicon.svg";
        }, 1);
    },
    
    /*
     * Based on cache, setting up the advanced tools during builder initializing
     */
    updateBuilderBasedOnSettings : function() {
        var builderSetting = null;
        var builderSettingJson = $.localStorage.getItem(CustomBuilder.builderType+"-settings");
        if (builderSettingJson !== null && builderSettingJson !== undefined) {
            builderSetting = JSON.decode(builderSettingJson);
        } else {
            builderSetting = {
                rightPanel : true,
                advanceTools : false
            };
            $.localStorage.setItem(CustomBuilder.builderType+"-settings", JSON.encode(builderSetting));
        }

        if (builderSetting.rightPanel === undefined || builderSetting.rightPanel === true) {
            $("body").addClass("property-editor-right-panel");
        } else {
            $("body").removeClass("property-editor-right-panel");
        }
        
        if (builderSetting.advanceTools !== undefined && builderSetting.advanceTools === true) {
            $("body").addClass("advanced-tools-supported");
        } else {
            $("body").removeClass("advanced-tools-supported");
        }
    },
    
    /*
     * Update builder setting in cache
     */
    setBuilderSetting : function(key, value) {
        var builderSetting = null;
        var builderSettingJson = $.localStorage.getItem(CustomBuilder.builderType+"-settings");
        if (builderSettingJson !== null && builderSettingJson !== undefined) {
            builderSetting = JSON.decode(builderSettingJson);
        } else {
            builderSetting = {
                rightPanel : true,
                advanceTools : false
            };
        }
        builderSetting[key] = value;
        $.localStorage.setItem(CustomBuilder.builderType+"-settings", JSON.encode(builderSetting));
    },
    
    /*
     * Get builder setting in cache
     */
    getBuilderSetting : function(key) {
        var builderSetting = null;
        var builderSettingJson = $.localStorage.getItem(CustomBuilder.builderType+"-settings");
        if (builderSettingJson !== null && builderSettingJson !== undefined) {
            builderSetting = JSON.decode(builderSettingJson);
        } else {
            builderSetting = {
                rightPanel : true,
                advanceTools : false
            };
            $.localStorage.setItem(CustomBuilder.builderType+"-settings", JSON.encode(builderSetting));
        }
        return builderSetting[key];
    },
    
    showPopUpBuilderProperties : function() {
        
    },
    
    /*
     * Retrieve the properties value for Properties page
     */
    getBuilderProperties : function() {
        if (CustomBuilder.config.builder.callbacks["getBuilderProperties"] !== "") {
            return CustomBuilder.callback(CustomBuilder.config.builder.callbacks["getBuilderProperties"], []);
        } else {
            return CustomBuilder.data.properties;
        }
    },
    
    /*
     * Save the properties value in Properties page
     */
    saveBuilderProperties : function(container, properties) {
        if (CustomBuilder.config.builder.callbacks["saveBuilderProperties"] !== "") {
            CustomBuilder.callback(CustomBuilder.config.builder.callbacks["saveBuilderProperties"], [container, properties]);
        } else {
            var builderProperties = CustomBuilder.getBuilderProperties();
            builderProperties = $.extend(builderProperties, properties);
            CustomBuilder.update();
        }
    },
    
    /*
     * Used to create additional palette tabs
     */
    initPaletteElmentTabs : function(defaultTab, tabs) {
        $("#elements-tabs").show();
        $("#components-tab").attr("title", defaultTab.label);
        $("#components-tab small").text(defaultTab.label);
        if (defaultTab.image !== undefined && defaultTab.image !== "") {
            $("#components-tab").prepend('<img src="'+defaultTab.image+'" />');
        }
        
        if (tabs !== undefined && tabs.length > 0) {
            for (var i in tabs) {
                var li = $('<li class="nav-item component-tab"><a class="nav-link" id="'+tabs[i].name+'-tab" data-toggle="tab" href="#'+tabs[i].name+'" role="tab" aria-controls="'+tabs[i].name+'" aria-selected="false" title="'+tabs[i].label+'"><div><small>'+tabs[i].label+'</small></div></a></li>');
                if (tabs[i].image !== undefined && tabs[i].image !== "") {
                    $(li).find("a").prepend('<img src="'+tabs[i].image+'" />');
                }
                $("#elements-tabs").append(li);
                
                var tabPane = $('<div class="tab-pane fade" id="'+tabs[i].name+'" role="tabpanel" aria-labelledby="'+tabs[i].name+'-tab"> \
                        <div class="search"> \
                            <input class="form-control form-control-sm component-search" placeholder="'+get_cbuilder_msg("cbuilder.search")+'" type="text" data-cbuilder-action="tabSearch" data-cbuilder-on="keyup"> \
                            <button class="clear-backspace"  data-cbuilder-action="clearTabSearch"> \
                                <i class="la la-close"></i> \
                            </button> \
                        </div> \
                        <div class="drag-elements-sidepane sidepane"> \
                            <div> \
                                <ul class="components-list clearfix" data-type="leftpanel"> \
                                </ul>\
                            </div> \
                        </div> \
                    </div>');
                
                $("#elements-tabs").next().append(tabPane);
            }
        }
    },
    
    /*
     * Add element to palette
     */
    initPaletteElement : function(category, className, label, icon, propertyOptions, defaultPropertiesValues, render, css, metaData, tab){
        if (this.paletteElements[className] !== undefined) {
            return;
        }
        if (tab === undefined || tab === "") {
            tab = "components";
        }
        if ((typeof propertyOptions) === "string") {
            try {
                propertyOptions = eval(propertyOptions);
            } catch (err) {
                if (console.log) {
                    console.log("error retrieving properties options of " + label + " : " + err);
                }
                return;
            }
        }
        if ((typeof defaultPropertiesValues) === "string") {
            try {
                defaultPropertiesValues = eval("["+defaultPropertiesValues+"]")[0];
            } catch (err) {
                if (console.log) {
                    console.log("error retrieving default property values of " + label + " : " + err);
                }
                return;
            }
        }
        
        if (css === undefined || css === null) {
            css = "";
        }
        
        var licss = "";
        if (metaData !== undefined && metaData.list_css !== undefined) {
            licss = metaData.list_css;
        }
        
        this.paletteElements[className] = new Object();
        this.paletteElements[className]['className'] = className;
        this.paletteElements[className]['label'] = label;
        this.paletteElements[className]['propertyOptions'] = propertyOptions;
        this.paletteElements[className]['properties'] = defaultPropertiesValues;
        
        var iconObj = null;
        var iconStr = "";
        if (icon !== undefined && icon !== null && icon !== "") {
            try {   
                iconObj = $(icon);
                iconStr = icon;
            } catch (err) {
                iconObj =  $('<span class="image" style="background-image:url(\'' + CustomBuilder.contextPath + icon + '\');" />');
                iconStr = '<span class="image" style="background-image:url(\'' + CustomBuilder.contextPath + icon + '\');" />';
            }
        } else {
            iconObj = $('<i class="fas fa-th-large"></i>');
            iconStr = '<i class="fas fa-th-large"></i>';
        }
        this.paletteElements[className]['icon'] = iconStr;
        
        if (metaData !== undefined && metaData !== null) {
            this.paletteElements[className] = $.extend(this.paletteElements[className], metaData);
        }

        if (render === undefined || render !== false) {
            var categoryId = CustomBuilder.createPaletteCategory(category, tab);
            var container = $('#'+ tab + '_comphead_' + categoryId + '_list');

            var li = $('<li class="'+licss+'"><div id="'+className.replaceAll(".", "_")+'" element-class="'+className+'" class="builder-palette-element '+css+'"> <a href="#">'+UI.escapeHTML(label)+'</a></div></li>');
            $(li).find('.builder-palette-element').prepend(iconObj);
            $(container).append(li);
        }
    },
    
    /*
     * Add palette category to tab
     */
    createPaletteCategory : function(category, tab) {
        if (tab === undefined || tab === "") {
            tab = "components";
        }
        
        var categoryId = "default";
        if (category === undefined || category === null || category === "") {
            category = "&nbsp;";
        } else {
            categoryId = category.replace(/\s/g , "-");
            if (!/^[A-Za-z][-A-Za-z0-9_:.]*$/.test(categoryId)) {
                categoryId = "palette-" + CustomBuilder.hashCode(category);
            }
        }
        var list = $("#"+tab + " .components-list");
        if ($('#'+ tab + '_comphead_' + categoryId + '_list').length === 0) {
            list.append('<li class="header clearfix" data-section="' + tab + '-' + categoryId + '"  data-search=""><label class="header" for="' + tab + '_comphead_' + categoryId + '">' + category + '  <div class="la la-angle-down header-arrow"></div>\
                            </label><input class="header_check" type="checkbox" checked="true" id="' + tab + '_comphead_' + categoryId + '">  <ol id="' + tab + '_comphead_' + categoryId + '_list"></ol></li>');
        }
        return categoryId;
    },
    
    /*
     * Remove a category from palette
     */
    clearPaletteCategory : function(category, tab) {
        if (tab === undefined || tab === "") {
            tab = "components";
        }
        
        var categoryId = "default";
        if (category === undefined || category === null || category === "") {
            category = "&nbsp;";
        } else {
            categoryId = category.replace(/\s/g , "-");
            if (!/^[A-Za-z][-A-Za-z0-9_:.]*$/.test(categoryId)) {
                categoryId = "palette-" + CustomBuilder.hashCode(category);
            }
        }
        var list = $("#"+tab + " .components-list");
        var container = $('#'+ tab + '_comphead_' + categoryId + '_list');
        
        $(container).find("[element-class]").each(function() {
            var className = $(this).attr("element-class");
            delete CustomBuilder.paletteElements[className];
        });
        
        container.html("");
    },
    
    /*
     * Retrieve permission plugin available for the builder
     */
    initPermissionList : function(classname){
        $.getJSON(
            CustomBuilder.contextPath + '/web/property/json/getElements?classname=' + classname,
            function(returnedData){
                for (e in returnedData) {
                    if (returnedData[e].value !== "") {
                        CustomBuilder.availablePermission[returnedData[e].value] = returnedData[e].label;
                    }
                }
            }
        );
    },
    
    /*
     * Load and render the JSON data to canvas
     */
    loadJson : function(json, addToUndo) {
        CustomBuilder.json = json;
        try {
            CustomBuilder.data = JSON.decode(json);
        } catch (e) {}
        
        //callback to render json
        CustomBuilder.callback(CustomBuilder.config.builder.callbacks["load"], [CustomBuilder.data]);
    },
    
    /*
     * Update JSON data base on CustomBuilder.data
     */
    update : function(addToUndo) {
        var json = JSON.encode(CustomBuilder.data);
        CustomBuilder.updateJson(json, addToUndo);
        CustomBuilder.updatePasteIcons();
    },
    
    /*
     * Update JSON data
     */
    updateJson : function (json, addToUndo) {
        if (CustomBuilder.json !== null && addToUndo !== false) {
            CustomBuilder.addToUndo();
        }
        
        CustomBuilder.json = json;
        CustomBuilder.adjustJson();
    },
    
    /*
     * Get the generated JSON
     */
    getJson : function () {
        return CustomBuilder.json;
    },
    
    /*
     * Save JSON 
     */
    save : function(){
        CustomBuilder.showMessage(get_cbuilder_msg('cbuilder.saving'));
        var self = CustomBuilder;
        var json = CustomBuilder.getJson();
        $.post(CustomBuilder.saveUrl, {json : json} , function(data) {
            var d = JSON.decode(data);
            if(d.success == true){
                $('#cbuilder-json-original').val(json);
                CustomBuilder.updateSaveStatus("0");
                CustomBuilder.showMessage(get_cbuilder_msg('ubuilder.saved'), "success");
            }else{
                CustomBuilder.showMessage(get_cbuilder_msg('ubuilder.saveFailed'), "danger");
            }
        }, "text");
    },

    /*
     * Preview generated JSON result
     */
    preview : function() {
        $('#cbuilder-json').val(CustomBuilder.getJson());
        $('#cbuilder-preview').attr("action", CustomBuilder.previewUrl);
        $('#cbuilder-preview').submit();
        return false;
    },
    
    /*
     * Used by advanced tool definition tab to update JSON
     */
    updateFromJson: function() {
        var json = $('#cbuilder-json').val();
        if (CustomBuilder.getJson() !== json) {
            CustomBuilder.loadJson(json);
        }
        return false;
    },
    
    /*
     * Undo the changes from stack
     */
    undo : function(){
        if(CustomBuilder.undoStack.length > 0){
            //if redo stack is full, delete first
            if(CustomBuilder.redoStack.length >= CustomBuilder.undoRedoMax){
                CustomBuilder.redoStack.splice(0,1);
            }

            //save current json data to redo stack
            CustomBuilder.redoStack.push(CustomBuilder.getJson());

            CustomBuilder.loadJson(CustomBuilder.undoStack.pop(), false);

            //enable redo button if it is disabled previously
            if(CustomBuilder.redoStack.length === 1){
                $('#redo-btn').removeClass('disabled');
            }

            //if undo stack is empty, disabled undo button
            if(CustomBuilder.undoStack.length === 0){
                $('#undo-btn').addClass('disabled');
            }

            CustomBuilder.updateSaveStatus("-");
        }
    },

    /*
     * Redo the changes from stack
     */
    redo : function(){
        if(CustomBuilder.redoStack.length > 0){
            //if undo stack is full, delete first
            if(CustomBuilder.undoStack.length >= CustomBuilder.undoRedoMax){
                CustomBuilder.undoStack.splice(0,1);
            }

            //save current json data to undo stack
            CustomBuilder.undoStack.push(CustomBuilder.getJson());

            CustomBuilder.loadJson(CustomBuilder.redoStack.pop(), false);

            //enable undo button if it is disabled previously
            if(CustomBuilder.undoStack.length === 1){
                $('#undo-btn').removeClass('disabled');
            }

            //if redo stack is empty, disabled redo button
            if(CustomBuilder.redoStack.length === 0){
                $('#redo-btn').addClass('disabled');
            }

            CustomBuilder.updateSaveStatus("+");
        }
    },
    
    /*
     * Add changes JSON to stack
     */
    addToUndo : function(json){
        //if undo stack is full, delete first
        if(CustomBuilder.undoStack.length >= CustomBuilder.undoRedoMax){
            CustomBuilder.undoStack.splice(0,1);
        }
        
        if (json === null || json === undefined) {
            json = CustomBuilder.getJson();
        }

        //save current json data to undo stack
        CustomBuilder.undoStack.push(json);

        //enable undo button if it is disabled previously
        if(CustomBuilder.undoStack.length === 1){
            $('#undo-btn').removeClass('disabled');
        }

        CustomBuilder.updateSaveStatus("+");
    },
    
    /*
     * Update the JSON for preview and advanced tools definition tab, then trigger 
     * a change event
     */
    adjustJson: function() {
        // update JSON
        $('#cbuilder-json').val(CustomBuilder.getJson()).trigger("change");
    },
    
    /*
     * Track the save status
     */
    updateSaveStatus : function(mode){
        if(mode === "+"){
            CustomBuilder.saveChecker++;
        }else if(mode === "-"){
            CustomBuilder.saveChecker--;
        }else if(mode === "0"){
            CustomBuilder.saveChecker = 0;
        }
    },
    
    /*
     * Show notifcation message
     */
    showMessage: function(message, type) {
        if (message && message !== "") {
            var id = "toast-" + (new Date()).getTime();
            var delay = 1500;
            if (type === undefined) {
                type = "secondary";
                delay = 500;
            }
            var toast = $('<div id="'+id+'" role="alert" aria-live="assertive" aria-atomic="true" class="toast alert-dismissible toast-'+type+'" data-autohide="true">\
                '+message+'\
                <button type="button" class="close" data-dismiss="toast" aria-label="'+get_cbuilder_msg("cbuilder.close")+'">\
                    <span aria-hidden="true">&times;</span>\
                </button>\
              </div>');
            
            $("#builder-message").append(toast);
            $('#'+id).toast({delay : delay});
            $('#'+id).toast("show");
            $('#'+id).on('hidden.bs.toast', function () {
                $('#'+id).remove();
            });
        }
    },
    
    /*
     * Retrieve copied element in cache
     */
    getCopiedElement : function() {
        var time = $.localStorage.getItem("customBuilder_"+CustomBuilder.builderType+".copyTime");
        //10 mins
        if (time !== undefined && time !== null && ((new Date()) - (new Date(time))) > 3000000) {
            $.localStorage.removeItem("customBuilder_"+CustomBuilder.builderType+".copyTime");
            $.localStorage.removeItem("customBuilder_"+CustomBuilder.builderType+".copy");
            return null;
        }
        var copied = $.localStorage.getItem("customBuilder_"+CustomBuilder.builderType+".copy");
        if (copied !== undefined && copied !== null) {
            return JSON.decode(copied);
        }
        return null;
    },
    
    /*
     * Copy an element
     */
    copy : function(element, type) {
        var copy = new Object();
        copy['type'] = type;
        copy['object'] = element;
        
        $.localStorage.setItem("customBuilder_"+CustomBuilder.builderType+".copy", JSON.encode(copy));
        $.localStorage.setItem("customBuilder_"+CustomBuilder.builderType+".copyTime", new Date());
        CustomBuilder.updatePasteIcon(type);
        CustomBuilder.showMessage(get_cbuilder_msg('ubuilder.copied'), "info");
    },
    
    /*
     * Update paste icon based on copied element 
     * Not used in DX8, it is for backward compatible
     */
    updatePasteIcon : function(type) {
        $(".element-paste").addClass("disabled");
        $(".element-paste."+type).removeClass("disabled");
    },
    
    /*
     * Update paste icon based on copied element 
     * Not used in DX8, it is for backward compatible
     */
    updatePasteIcons : function() {
        var type = "dummyclass";
        var copied = CustomBuilder.getCopiedElement();
        if (copied !== null) {
            type = copied['type'];
        }
        CustomBuilder.updatePasteIcon(type);
    },
    
    /*
     * Check the diff before save and also use for advanced tool check diff tab
     */
    showDiff : function (callback, output) {
        var jsonUrl = CustomBuilder.contextPath + '/web/json/console/app/' + CustomBuilder.appId + '/' + CustomBuilder.appVersion + '/cbuilder/'+CustomBuilder.builderType+'/json/' + CustomBuilder.data.properties.id;
        if (CustomBuilder.config.builder.options["getDefinitionUrl"] !== "") {
            jsonUrl = CustomBuilder.config.builder.options["getDefinitionUrl"];
        }
        
        var thisObject = CustomBuilder;
        var merged;
        var currentSaved;
        $.ajax({
            type: "GET",
            url: jsonUrl,
            dataType: 'json',
            success: function (data) {
                var current = data;
                var currentString = JSON.stringify(data);
                currentSaved = currentString;
                $('#cbuilder-json-current').val(currentString);
                var original = JSON.decode($('#cbuilder-json-original').val());
                var latest = JSON.decode($('#cbuilder-json').val());
                merged = DiffMerge.merge(original, current, latest, output);
            },
            error: function() {
                currentSaved = $('#cbuilder-json-current').val();
                merged = $('#cbuilder-json').val();
            },
            complete: function() {
                if (callback) {
                    callback.call(thisObject, currentSaved, merged);
                }    
            }
        });
    },
    
    /*
     * Merge the diff between local and remote
     */
    merge: function (callback) {
        // get current remote definition
        CustomBuilder.showMessage(get_cbuilder_msg('ubuilder.merging'));
        var thisObject = CustomBuilder;
        
        CustomBuilder.showDiff(function (currentSaved, merged) {
            if (currentSaved !== undefined && currentSaved !== "") {
                $('#cbuilder-json-original').val(currentSaved);
            }
            if (merged !== undefined && merged !== "") {
                $('#cbuilder-json').val(merged);
            }
            CustomBuilder.updateFromJson();
            
            if (callback) {
                callback.call(thisObject, merged);
            }
        });
    },
    
    /*
     * Merge remote change and save
     */
    mergeAndSave: function() {
        CustomBuilder.merge(CustomBuilder.save);
    }, 
    
    /*
     * Builder support tree viewer in advanced tool based on config
     */
    supportTreeViewer: function() {
        return !CustomBuilder.config.advanced_tools.tree_viewer.disabled;
    },
    
    /*
     * Builder support xray viewer in advanced tool based on config
     */
    supportXray: function() {
        return !CustomBuilder.config.advanced_tools.xray.disabled;
    },
    
    /*
     * Builder support i18n editor in advanced tool based on config
     */
    supportI18n: function() {
        return !CustomBuilder.config.advanced_tools.i18n.disabled;
    },
    
    /*
     * Builder support check usage in advanced tool based on config
     */
    supportUsage: function() {
        return !CustomBuilder.config.advanced_tools.usage.disabled;
    },
    
    /*
     * Builder support permission editor in advanced tool based on config
     */
    supportPermission: function() {
        return !CustomBuilder.config.advanced_tools.permission.disabled;
    },
    
    /*
     * Used to initialize additional advanced tool tabs in toolbar
     */
    customAdvancedToolTabs: function() {
        CustomBuilder.callback(CustomBuilder.config.advanced_tools["customTabsCallback"]);
    },
    
    /*
     * Used by advanced tool permission tab to retrieve element label
     */
    getPermissionElementLabel: function(element) {
        if (element["className"] !== undefined && element["className"] !== "") {
            var plugin = CustomBuilder.paletteElements[element["className"]];
            if (plugin !== null && plugin !== undefined) {
                return plugin.label;
            }
        }
        return "";
    },
    
    /*
     * Deprecated
     */
    saveBuilderPropertiesfunction(container, properties){
        CustomBuilder.data.properties = $.extend(CustomBuilder.data.properties, properties);
        CustomBuilder.update();

        $('#step-design').click();
    },
    
    /*
     * Edit an element properties in right panel or popup dialog
     */
    editProperties: function(elementClass, elementProperty, elementObj, element) {
        var paletteElement = CustomBuilder.paletteElements[elementClass];
        
        if (paletteElement === undefined) {
            return;
        }
        var elementOptions = paletteElement.propertyOptions;
        
        if (paletteElement.builderTemplate !== undefined && paletteElement.builderTemplate.customPropertyOptions !== undefined) {
            elementOptions = paletteElement.builderTemplate.customPropertyOptions(elementOptions, element, elementObj, paletteElement);
        }
        
        // show property dialog
        var options = {
            appPath: "/" + CustomBuilder.appId + "/" + CustomBuilder.appVersion,
            contextPath: CustomBuilder.contextPath,
            propertiesDefinition : elementOptions,
            propertyValues : elementProperty,
            showCancelButton:true,
            changeCheckIgnoreUndefined: true,
            cancelCallback: function() {
                CustomBuilder.callback(CustomBuilder.config.builder.callbacks["cancelEditProperties"], [elementObj, element]);
            },
            saveCallback: function(container, properties) {
                elementProperty = $.extend(elementProperty, properties);
                
                CustomBuilder.callback(CustomBuilder.config.builder.callbacks["saveEditProperties"], [container, elementProperty, elementObj, element]);
                CustomBuilder.update();
            }
        };
        
        if ($("body").hasClass("property-editor-right-panel")) {
            CustomBuilder.clearPropertySearch();
            $("#right-panel #element-properties-tab").find(".property-editor-container").remove();
            
            options['editorPanelMode'] = true;
            options['showCancelButton'] = false;
            options['closeAfterSaved'] = false;
            options['saveCallback'] = function(container, properties) {
                var d = $(container).find(".property-editor-container").data("deferred");
                d.resolve({
                    container :container, 
                    prevProperties : elementProperty, 
                    properties : properties, 
                    elementObj : elementObj,
                    element : element
                });
            };
            options['validationFailedCallback'] = function(container, errors) {
                var d = $(container).find(".property-editor-container").data("deferred");
                d.resolve({
                    container :container,  
                    prevProperties : elementProperty, 
                    errors : errors, 
                    elementObj : elementObj,
                    element : element
                });
            };
            
            $("#right-panel #element-properties-tab").propertyEditor(options);
            $("#element-properties-tab-link").show();
        } else {
            // show popup dialog
            if (!PropertyEditor.Popup.hasDialog(CustomBuilder.builderType+"-property-editor")) {
                PropertyEditor.Popup.createDialog(CustomBuilder.builderType+"-property-editor");
            }
            PropertyEditor.Popup.showDialog(CustomBuilder.builderType+"-property-editor", options);
        }
    },
    
    /*
     * Save element properties/styles changes when apply button (tick icon) in right panel is pressed
     */
    applyElementProperties : function() {
        var button = $(this);
        button.attr("disabled", "");
        $(".element-properties .nav-tabs .nav-link").removeClass("has-properties-errors");
        
        var deferreds = [];
        $(".element-properties .property-editor-container").each(function() {
            var d = $.Deferred();
            deferreds.push(d);
            $(this).data("deferred", d);
            
            $(this).find(".page-button-save").first().trigger("click");
        });
        
        $.when.apply($, deferreds).then(function() {
            var container = $(arguments[0].container);
            var prevProperties = arguments[0].prevProperties;
            var element = $(arguments[0].element);
            var elementObj = arguments[0].elementObj;
            var hasError = false;
            
            for (var i in arguments) {
                if (arguments[i].errors !== undefined) {
                    hasError = true;
                    var id = container.attr("id");
                    $(".element-properties .nav-tabs .nav-link[href='#"+id+"']").addClass("has-properties-errors");
                }
            }
            
            if (!hasError) {
                var elementProperty = prevProperties;
                var oldPropertiesJson = JSON.encode(elementProperty);
                
                for (var i in arguments) {
                    $.extend(elementProperty, arguments[i].properties);
                }
                
                //clean unuse styling 
                for (var property in elementProperty) {
                    if (elementProperty.hasOwnProperty(property)) {
                        if ((property.indexOf('attr-') === 0 || property.indexOf('css-') === 0 || property.indexOf('style-') === 0
                            || property.indexOf('-attr-') > 0 || property.indexOf('-css-') > 0 || property.indexOf('-style-') > 0) 
                            && elementProperty[property] === "") {
                            delete elementProperty[property];
                        }
                    }
                }
                
                var newPropertiesJson = JSON.encode(elementProperty);

                if (oldPropertiesJson !== newPropertiesJson) {
                    CustomBuilder.callback(CustomBuilder.config.builder.callbacks["saveEditProperties"], [container, elementProperty, elementObj, element]);
                    
                    if ($("body").hasClass("default-builder")) {
                        var updateDeferreds = [];
                        CustomBuilder.Builder.updateElement(elementObj, element, updateDeferreds);
                        $.when.apply($, updateDeferreds).then(function() {
                            button.removeAttr("disabled");
                            CustomBuilder.Builder.triggerChange();
                        });
                    } else {
                        button.removeAttr("disabled");
                    }
                    CustomBuilder.update();
                }
            } 
            button.removeAttr("disabled");
        });
    },
    
    /*
     * Utility method to generate an uuid
     */
    uuid : function(){
        return 'xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {  //xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        }).toUpperCase();
    },
    
    /*
     * Generate an unique hash code for a string
     */
    hashCode : function(s) {
        var h = 0, l = s.length, i = 0;
        if ( l > 0 )
          while (i < l)
            h = (h << 5) - h + s.charCodeAt(i++) | 0;
        return h;
    },
    
    /*
     * Show the advanced tools
     */
    enableEnhancedTools : function() {
        $("body").addClass("advanced-tools-supported");
        CustomBuilder.setBuilderSetting("advanceTools", true);
    },
    
    /*
     * Hide the advanced tools
     */
    disableEnhancedTools : function() {
        $("body").removeClass("advanced-tools-supported");
        CustomBuilder.setBuilderSetting("advanceTools", false);
        $("#design-btn").trigger("click");
    },
    
    /*
     * Show/hide builder left panel
     */
    toogleLeftPanel : function() {
        if ($(this).find("i").hasClass("la-angle-left")) {
            $("body").addClass("left-panel-closed");
            $(this).find("i").removeClass("la-angle-left").addClass("la-angle-right");
        } else {
            $("body").removeClass("left-panel-closed");
            $(this).find("i").removeClass("la-angle-right").addClass("la-angle-left");
        }
    },
    
    /*
     * Show/hide builder right panel
     */
    toogleRightPanel : function() {
        if ($(this).find("i").hasClass("la-angle-right")) {
            $("body").addClass("right-panel-closed");
            $(this).find("i").removeClass("la-angle-right").addClass("la-angle-left");
        } else {
            $("body").removeClass("right-panel-closed");
            $(this).find("i").removeClass("la-angle-left").addClass("la-angle-right");
        }
    },
    
    /*
     * Animate the builder left panel to reopen it
     */
    animateLeftPanel : function() {
        $("body").removeClass("left-panel-closed");
        $("#left-panel #left-panel-toogle").find("i").removeClass("la-angle-right").addClass("la-angle-left");
            
        $("#left-panel").off('animationend webkitAnimationEnd oAnimationEnd');
        $("#left-panel").on('animationend webkitAnimationEnd oAnimationEnd', function(){
            setTimeout(function(){$("#left-panel").removeClass("switchingLeft");}, 5);
        });
        $("#left-panel").addClass("switchingLeft");
    },
    
    /*
     * Switch builder view based on toolbar icon
     */
    switchView : function() {
        var $this = $(this);
        var view = $this.data("cbuilder-view");
        
        if ($this.is(".active-view")) {
            view = "design";
        }
        
        var currentView = $("[data-cbuilder-view].active-view").data("cbuilder-view");
        if (CustomBuilder.config.builder.callbacks[currentView+"ViewBeforeClosed"] !== undefined) {
            CustomBuilder.callback(CustomBuilder.config.builder.callbacks[currentView+"ViewBeforeClosed"], [$("#"+currentView+"View.builder-view .builder-view-body")]);
        } else if (CustomBuilder[currentView+"ViewBeforeClosed"] !== undefined) {
            CustomBuilder[currentView+"ViewBeforeClosed"]($("#"+currentView+"View.builder-view .builder-view-body"));
        }
        $("body").removeClass(currentView+"-builder-view");
        
        $("[data-cbuilder-view]").removeClass("active-view active");
        $(".builder-view").hide();
        
        $("[data-cbuilder-view='"+view+"']").addClass("active-view");
        
        if (view !== "design") {
            var viewDiv = $("#"+view+"View.builder-view");
            if (viewDiv.length === 0) {
                viewDiv = $('<div id="'+view+'View" class="builder-view" style="display:none"><div class="builder-view-header"></div><div class="builder-view-body"></div></div>');
                $("body").append(viewDiv);
            }  
            if (CustomBuilder.config.builder.callbacks[view+"ViewInit"] !== undefined) {
                CustomBuilder.callback(CustomBuilder.config.builder.callbacks[view+"ViewInit"], [$(viewDiv).find('.builder-view-body')]);
            } else if (CustomBuilder[view+"ViewInit"] !== undefined) {
                CustomBuilder[view+"ViewInit"]($(viewDiv).find('.builder-view-body'));
            }
            $("#"+view+"View.builder-view").show();
            $(viewDiv).find('.builder-view-body').trigger("builder-view-show");
            $("body").addClass(view+"-builder-view");
        }
        
        //for builder
        $("#element-highlight-box, #element-select-box").hide();
        $("body").addClass("no-right-panel");
    },
    
    /*
     * Show the builder properties view, called by switchView method
     */
    propertiesViewInit : function(view) {
        $(view).html("");
        
        var props = CustomBuilder.getBuilderProperties();
        
        var options = {
            appPath: CustomBuilder.appPath,
            contextPath: CustomBuilder.contextPath,
            propertiesDefinition : CustomBuilder.propertiesOptions,
            propertyValues : props,
            showCancelButton:false,
            closeAfterSaved : false,
            changeCheckIgnoreUndefined: true,
            autoSave: true,
            saveCallback: CustomBuilder.saveBuilderProperties
        };
        $("body").addClass("stop-scrolling");
        
        $(view).off("builder-view-show");
        $(view).on("builder-view-show", function(){
            $(view).propertyEditor(options);
        });
    },
    
    /*
     * Show the builder preview view, called by switchView method
     */
    previewViewInit : function(view) {
        $(view).html('<div id="preview-iframe-wrapper"><iframe id="preview-iframe" name="preview-iframe" src="about:none"></iframe></div>');
        
        var viewport = $(".responsive-buttons button.active").data("view");
	$(view).closest(".builder-view").addClass(viewport);
        
        var securityToken = ConnectionManager.tokenName + "=" + ConnectionManager.tokenValue;
        $('#cbuilder-preview').attr("action", CustomBuilder.previewUrl + "?" + securityToken);
        $('#cbuilder-preview').attr("target", "preview-iframe");
        $('#cbuilder-preview').submit();
        return false;
    },
    
    /*
     * Show the tree viewer on left panel, called by switchView method
     */
    treeViewerViewInit : function(view) {
        if ($("body").hasClass("default-builder")) {
            $(view).closest(".builder-view").addClass("treeRightPanel");
            $(view).closest(".builder-view").prependTo($("#left-panel")).css("top", "0px");
            CustomBuilder.animateLeftPanel();
            view.addClass("panel-section tree");
            view.html("");
            view.append('<div class="panel-header"><span class="text-secondary">'+get_advtool_msg("adv.tool.Tree.Viewer")+'</span></div><div class="tree-container scrollable tree"></div>');
            
            CustomBuilder.Builder.renderTreeMenu(view.find(".tree-container"));
            
            $(CustomBuilder.Builder.iframe).off("change.builder");
            $(CustomBuilder.Builder.iframe).on("change.builder", function() {
                if ($(view).is(":visible")) {
                    view.find(".tree-container").html("");
                    CustomBuilder.Builder.renderTreeMenu(view.find(".tree-container"));
                }
            });
        }
    },
    
    /*
     * Run before tree viewer view dismiss, called by switchView method
     */
    treeViewerViewBeforeClosed : function(view) {
        if ($("body").hasClass("default-builder")) {
            CustomBuilder.animateLeftPanel();
        }
    },
    
    /*
     * Show the xray view, called by switchView method
     */
    xrayViewInit : function(view) {
        CustomBuilder.treeViewerViewInit(view);
        if ($("body").hasClass("default-builder")) {
            CustomBuilder.Builder.renderNodeAdditional('Xray');
        }
    },
    
    /*
     * Run before xray view dismiss, called by switchView method
     */
    xrayViewBeforeClosed : function(view) {
        if ($("body").hasClass("default-builder")) {
            CustomBuilder.Builder.removeNodeAdditional();
            CustomBuilder.animateLeftPanel();
        }
    },
    
    /*
     * Show the permission editor view, called by switchView method
     */
    permissionViewInit : function(view) {
        if ($("body").hasClass("default-builder")) {
            view.html("");
            $("body").addClass("disable-select-edit");
            
            view.append('<div class="permission-rules panel-section"><div class="panel-header"><span class="text-secondary">'+get_advtool_msg("adv.permission.rules")+'</span></div><div class="permission-rules-container scrollable"></div></div>');
            
            var ruleObject = CustomBuilder.data.properties;
            if (CustomBuilder.config.builder.callbacks["getRuleObject"] !== undefined && CustomBuilder.config.builder.callbacks["getRuleObject"] !== "") {
                ruleObject = CustomBuilder.callback(CustomBuilder.config.builder.callbacks["getRuleObject"], []);
            }
            
            CustomBuilder.Builder.renderPermissionRules(view.find(".permission-rules"), ruleObject);
            
            var tree = $('<div class="tree-viewer"></div>');
            view.append(tree);
            CustomBuilder.treeViewerViewInit(tree);
        } else {
            $(view).prepend('<i class="dt-loading fas fa-5x fa-spinner fa-spin"></i>');
            PermissionManager.init($(view), $("#cbuilder-info").find('textarea[name="json"]').val(), CustomBuilder.advancedToolsOptions);
            $(view).find(".dt-loading").remove();
            
            $("#cbuilder-info").find('textarea[name="json"]').off("change.permissionView");
            $("#cbuilder-info").find('textarea[name="json"]').on("change.permissionView", function() {
                if (!$(view).is(":visible")) { //ignore if current tab is permission tab
                    $(view).html("");
                }
            });
        }
    },
    
    /*
     * Run before permission editor dismiss, called by switchView method
     */
    permissionViewBeforeClosed : function(view) {
        if ($("body").hasClass("default-builder")) {
            CustomBuilder.Builder.removeNodeAdditional();
            CustomBuilder.animateLeftPanel();
            $("body").removeClass("disable-select-edit");
        }
    },
    
    /*
     * Show the find usage view, called by switchView method
     */
    findUsagesViewInit : function(view) {
        if ($(view).find(".item_usages_container").length === 0) {
            $(view).prepend('<i class="dt-loading fas fa-5x fa-spinner fa-spin"></i>');
            Usages.render($(view), CustomBuilder.id, CustomBuilder.advancedToolsOptions.builder, CustomBuilder.advancedToolsOptions);
            $(view).find(".dt-loading").remove();
        }
    },
    
    /*
     * Show the i18n editor view, called by switchView method
     */
    i18nViewInit : function(view) {
        if ($(view).find(".i18n_table").length === 0) {
            $(view).html("");
            $(view).prepend('<i class="dt-loading fas fa-5x fa-spinner fa-spin"></i>');
            I18nEditor.init($(view), $("#cbuilder-info").find('textarea[name="json"]').val(), CustomBuilder.advancedToolsOptions);
            $(view).find(".dt-loading").remove();
            
            $("#cbuilder-info").find('textarea[name="json"]').off("change.i18n");
            $("#cbuilder-info").find('textarea[name="json"]').on("change.i18n", function() {
                $(view).html("");
            });
        }
        setTimeout(function(){
            I18nEditor.refresh($(view));
        }, 5);
    },
    
    /*
     * Show the diff checker view, called by switchView method
     */
    diffCheckerViewInit : function(view) {
        $(view).html("");
        
        CustomBuilder.showDiff(function (merge) {
            if ($(view).find("#diff1").length > 0) {
                $(view).find("#diff1").before('<h4>'+get_advtool_msg('diff.checker.newChanges')+'</h4>');
                $(view).find("#diff2").before('<h4>'+get_advtool_msg('diff.checker.mergedChanges')+'</h4>');
                $(view).append('<div class="sticky-buttons"><a class="update button">'+get_advtool_msg('diff.checker.merge.update')+'</span></a></div>')
                $(view).find(".sticky-buttons").css("top", "20px");
            } else if ($(view).find("#diff2").length > 0) {
                $(view).find("#diff2").before('<h4>'+get_advtool_msg('diff.checker.changes')+'</h4>');
            } else {
                $(view).append('<p>'+get_advtool_msg('diff.checker.noChanges')+'</p>');
            }
        }, $(view));

        $(view).on("click", "a.update", function(){
            CustomBuilder.merge();
            $("#design-btn").trigger("click");
        });
    },
    
    /*
     * Show the JSON definition view, called by switchView method
     */
    jsonDefViewInit : function(view) {
        if ($(view).find($("#cbuilder-info")).length === 0) {
            $(view).append($("#cbuilder-info"));
            $("#cbuilder-info").show();
            $("#cbuilder-info").prepend('<pre id="json_definition"></pre>');

            var editor = ace.edit("json_definition");
            editor.$blockScrolling = Infinity;
            editor.setTheme("ace/theme/textmate");
            editor.getSession().setTabSize(4);
            editor.getSession().setMode("ace/mode/json");
            editor.setAutoScrollEditorIntoView(true);
            editor.setOption("maxLines", 1000000); //unlimited, to fix the height issue
            editor.setOption("minLines", 10);
            editor.resize();
            var textarea = $("#cbuilder-info").find('textarea[name="json"]').hide();
            $(textarea).on("change", function() {
                if (!CustomBuilder.editorSilentChange) {
                    CustomBuilder.editorSilentChange = true;
                    var jsonObj = JSON.decode($(this).val());
                    editor.getSession().setValue(JSON.stringify(jsonObj, null, 4));
                    editor.resize(true);
                    CustomBuilder.editorSilentChange = false;
                }
            });
            $(textarea).trigger("change");
            editor.getSession().on('change', function(){
                if (!CustomBuilder.editorSilentChange) {
                    CustomBuilder.editorSilentChange = true;
                    var value = editor.getSession().getValue();
                    if (value.length > 0) {
                        var jsonObj = JSON.decode(value);
                        textarea.val(JSON.encode(jsonObj)).trigger("change");
                    }
                    CustomBuilder.editorSilentChange = false;
                }
            });
            $("#cbuilder-info").find("button").addClass("button").wrap('<div class="sticky-buttons">');
            $("#cbuilder-info").find("button").on("click", function() {
                CustomBuilder.editorIsChange = true;
                var text = $(this).text();
                $(this).text(get_advtool_msg('adv.tool.updated'));
                $(this).attr("disabled", true);
                setTimeout(function(){
                    $("#cbuilder-info").find("button").text(text);
                    $("#cbuilder-info").find("button").removeAttr("disabled");
                }, 1000);
            });
            $(view).data("editor", editor);
        } else {
            var editor = $(view).data("editor");
            CustomBuilder.editorIsChange = false;
            editor.resize(true);
        }
    },
    
    /*
     * Run before JSON definition view dismiss, called by switchView method
     */
    jsonDefViewBeforeClosed : function(view) {
        if (!CustomBuilder.editorIsChange) {
            CustomBuilder.editorSilentChange = true;
            $("#cbuilder-info").find('textarea[name="json"]').val(CustomBuilder.getJson());
            CustomBuilder.editorSilentChange = false;
        }
    },
    
    /*
     * Search element in left panel when left panel search field keyup
     */
    tabSearch : function() {
        var searchText = this.value.toLowerCase();
	var tab = $(this).closest(".tab-pane");
	$(tab).find(".components-list li ol li").each(function () {
            var element = $(this);
            element.hide();
            if ($(element).find("a").text().toLowerCase().indexOf(searchText) > -1) { 
                element.show();
            }
	});
        if (this.value !== "") {
            $(this).next("button").show();
        } else {
            $(this).next("button").hide();
        }
    },
    
    /*
     * Clear the search on left panel when clear icon clicked 
     */
    clearTabSearch : function() {
        var tab = $(this).closest(".tab-pane");
        $(tab).find(".component-search").val("");
        $(tab).find(".components-list li ol li").show();
        $(this).hide();
    },
    
    /*
     * Toggle fullscreen mode
     */
    fullscreen : function() {
        if (document.documentElement.requestFullScreen) {

            if (document.FullScreenElement)
                document.exitFullScreen();
            else
                document.documentElement.requestFullScreen();
        //mozilla		
        } else if (document.documentElement.mozRequestFullScreen) {

            if (document.mozFullScreenElement)
                document.mozCancelFullScreen();
            else
                document.documentElement.mozRequestFullScreen();
        //webkit	  
        } else if (document.documentElement.webkitRequestFullScreen) {

            if (document.webkitFullscreenElement)
                document.webkitExitFullscreen();
            else
                document.documentElement.webkitRequestFullScreen();
        //ie	  
        } else if (document.documentElement.msRequestFullscreen) {

            if (document.msFullScreenElement)
                document.msExitFullscreen();
            else
                document.documentElement.msRequestFullscreen();
        }
    },
    
    /*
     * Cheange viewport based on viewport icon pressed
     */
    viewport : function (view) {
        if (typeof view !== "string") {
            view = $(view.target).closest("button").data("view");
        }
        $(".responsive-buttons button").removeClass("active");
        $(".responsive-buttons button#"+view+"-view").addClass("active");
	$("body, #builder_canvas, #previewView").removeClass("mobile tablet desktop").addClass(view);
        
        //for builder
        $("#element-highlight-box, #element-select-box").hide();
        $("body").addClass("no-right-panel");
        
        $("body").trigger($.Event("viewport.change", {"view": view}));
    },
    
    /*
     * Maximised the right panel
     */
    maxPropertiesWindow : function () {
        $("body").addClass("max-property-editor");
        $("#right-panel .property-editor-container").removeClass("narrow");
    },
    
    /*
     * Minimised the right panel
     */
    minPropertiesWindow : function () {
        $("body").removeClass("max-property-editor");
        $("#right-panel .property-editor-container").addClass("narrow");
    },
    
    /*
     * Close the right panel
     */
    closePropertiesWindow : function() {
        CustomBuilder.minPropertiesWindow();
        $("body").addClass("no-right-panel");
    },
    
    /*
     * Search property on right panel when search field keyup event
     */
    propertySearch : function() {
        var searchText = this.value.toLowerCase();
	var tab = $(this).closest(".element-properties");
        $(tab).find(".property-page-show").each(function() {
            var page = $(this);
            if ($(page).find(".property-editor-page-title > span").text().toLowerCase().indexOf(searchText) > -1) { 
                $(page).find(".property-editor-property").removeClass("property-search-hide");
            } else {
                $(page).find(".property-editor-property").each(function () {
                    var element = $(this);
                    element.addClass("property-search-hide");
                    if ($(element).find(".property-label").text().toLowerCase().indexOf(searchText) > -1) { 
                       element.removeClass("property-search-hide");
                    }
                });
            }
            
            if ($(page).find(".property-editor-property:not(.property-search-hide)").length > 0) {
                $(page).removeClass("property-search-hide");
            } else {
                $(page).addClass("property-search-hide");
            }
        });
        if (this.value !== "") {
            $(this).next("button").show();
        } else {
            $(this).next("button").hide();
        }
    },
    
    /*
     * Clear the search on right panel
     */
    clearPropertySearch : function() {
        var tab = $(this).closest(".element-properties");
        $(tab).find(".component-search").val("");
        $(tab).find(".property-search-hide").removeClass("property-search-hide");
        $(this).hide();
    },
    
    /*
     * Initialize a quick item navagation for all builders
     */
    initQuickNav : function() {
        setTimeout(function(){
            $.ajax({
                type: "GET",
                url: CustomBuilder.contextPath + "/web/json/console/app/"+CustomBuilder.appId+"/"+CustomBuilder.appVersion+"/adminbar/builder/menu",
                dataType: 'json',
                success: function (data) {
                    var container = $("#builder-menu > ul");
                    for (var i in data) {
                        var builder = data[i];
                        var li = $('<li class="menu-'+builder.value+'"><span title="'+builder.label+'" style="background: '+builder.color+'"><i class="'+builder.icon+'"></i></span><ul></ul></li>');
                        $(li).find("ul").append('<li class="header">'+builder.label+'</li>');
                        if (builder.elements) {
                            for (var j in builder.elements) {
                                $(li).find("ul").append('<li class="item"><a href="'+builder.elements[j].url+'" target="_self">'+builder.elements[j].label+'</a></li>');
                            }
                        }
                        $(li).find("ul").append('<li class="addnew"><a data-type="'+builder.value+'"><i class="las la-plus-circle"></i> '+get_cbuilder_msg("cbuilder.addnew")+'</a></li>');
                        container.append(li);
                    }

                    if (window["CustomBuilder"] !== undefined) {
                        $("#builder-menu > ul > li.menu-" + window["CustomBuilder"].builderType).addClass("active");
                    } else {
                        $("#builder-menu > ul > li:eq(0)").addClass("active");
                    }

                    $("#builder-menu > ul > li").on("mouseover touch", function(){
                        $("#builder-menu > ul > li").removeClass("active");
                        $(this).addClass("active");
                    });
                }
            });

            $("#builder-menu-search input").on("keyup", function(){
                var searchText = $(this).val().toLowerCase();
                $("#builder-menu ul li ul li.item").each(function(){
                    var element = $(this);
                    element.hide();
                    if ($(element).find("a").text().toLowerCase().indexOf(searchText) > -1) { 
                        element.show();
                    }
                });
            });

            $("#builder-menu-search .clear-backspace").on("click", function(){
                $("#builder-menu ul li ul li").show();
                $("#builder-menu-search input").val("");
            });

            $("#builder-menu ul").on("click", " li ul li.addnew a", function(){
                var type = $(this).data("type");
                if (type === "process") {
                    window.open(CustomBuilder.contextPath + '/web/console/app' + CustomBuilder.appPath + '/process/builder');
                } else {
                    var url = CustomBuilder.contextPath + '/web/console/app' + CustomBuilder.appPath + '/';
                    if (type === "form" || type === "datalist" || type === "userview") {
                        url += type + '/create?builderMode=true';
                    } else {
                        url += "cbuilder/" + type + "/create?builderMode=false";
                    }
                    JPopup.show("navCreateNewDialog", url, {}, "");
                }
                return false;
            });
            
        }, 100); //delay the loading to prevent it block the builder ajax call
    },
    
    /*
     * Utility method to get property for an object
     */
    getPropString : function(value) {
        return (value !== undefined && value !== null) ? value : "";
    },
    
    /*
     * Method used for toolbar to copy an element
     */
    copyElement : function() {
        if (CustomBuilder.Builder.selectedEl !== null) {
            CustomBuilder.Builder.copyNode();
        }
    },
    
    /*
     * Method used for toolbar to paste an element
     */
    pasteElement : function() {
        CustomBuilder.Builder.pasteNode();
    }
};

/*
 * Default builder to manage the palette and canvas
 */
CustomBuilder.Builder = {
    dragMoveMutation : false,
    options : {
        "enableViewport" : true,
        "enableCopyPaste" : true,
        callbacks : {
            "initComponent" : "",
            "renderElement" : "",
            "selectElement" : "",
            "updateElementId" : "",
            "unloadElement" : ""
        }
    },
    
    /*
     * A stating point to use the default builder
     */
    init : function(options, callback) {
        CustomBuilder.Builder.options = $.extend(true, CustomBuilder.Builder.options, options);
        
        if (CustomBuilder.Builder.options.enableViewport) {
            $("#top-panel .responsive-buttons").show();
            $("body").addClass("viewport-enabled");
            CustomBuilder.viewport("desktop");
        }
        
        if (CustomBuilder.Builder.options.enableCopyPaste) {
            $("#builderToolbar .copypaste").show();
            
            if (!(typeof document.addEventListener === "undefined")) {
                var hidden, visibilityChange;
                if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support 
                    hidden = "hidden";
                    visibilityChange = "visibilitychange";
                } else if (typeof document.msHidden !== "undefined") {
                    hidden = "msHidden";
                    visibilityChange = "msvisibilitychange";
                } else if (typeof document.webkitHidden !== "undefined") {
                    hidden = "webkitHidden";
                    visibilityChange = "webkitvisibilitychange";
                }

                document.addEventListener(visibilityChange, function(){
                    if (!document[hidden]) {
                        var element = self.selectedEl;
                        var data = CustomBuilder.data;
                        if (element !== null) {
                            data = $(element).data("data");
                        }
                        var component = self.parseDataToComponent(data);
                        if (component !== null && component.builderTemplate.isPastable(data, component)) {
                            $("#paste-element-btn").removeClass("disabled");
                        }
                    }
                }, false);
            }
        }
        
        var self = this;
        self.selectedEl = null;
	self.highlightEl = null;
                
        $("#builder_canvas").append('<div id="iframe-wrapper"> \
                <div id="iframe-layer"> \
                    <div id="element-highlight-box"> \
                        <div id="element-highlight-name"></div> \
                    </div> \
                    <div id="element-select-box"> \
                        <div id="element-select-name"></div> \
                        <div id="element-actions">   \
                            <a id="drag-btn" href="" title="'+get_cbuilder_msg("cbuilder.drag")+'"><i class="la la-arrows"></i></a> \
                            <a id="parent-btn" href="" title="'+get_cbuilder_msg("cbuilder.selectParent")+'"><i class="las la-level-up-alt"></i></a> \
                            <a id="up-btn" href="" title="'+get_cbuilder_msg("cbuilder.moveUp")+'"><i class="la la-arrow-up"></i></a> \
                            <a id="down-btn" href="" title="'+get_cbuilder_msg("cbuilder.moveDown")+'"><i class="la la-arrow-down"></i></a> \
                            <span id="element-options"> \
                                \
                            </span>   \
                            <a id="delete-btn" href="" title="'+get_cbuilder_msg("cbuilder.remove")+'"><i class="la la-trash"></i></a> \
                        </div> \
                        <div id="element-bottom-actions">   \
                        </div> \
                    </div> \
                </div> \
                <iframe src="about:none" id="iframe1"></iframe> \
            </div>');
        
        $("#style-properties-tab-link").show();
        
        self.documentFrame = $("#iframe-wrapper > iframe");
        self.canvas = $("#builder_canvas");
        
        $("body").addClass("default-builder");
        
        self._loadIframe(CustomBuilder.contextPath+'/builder/blank.jsp', callback);
        
        self._initDragdrop();
        self._initBox();
        
        self.dragElement = null;
    },
    
    /*
     * Render the json to canvas
     */
    load: function(data, callback) {
        var self = CustomBuilder.Builder;
        self.frameBody.html("");
        self.selectNode(false);
        $("#element-highlight-box").hide();
        
        var component = self.parseDataToComponent(data);
        var temp = $('<div></div>');
        self.frameBody.append(temp);
        self.renderElement(data, temp, component, false, null, callback);
        
        if (component !== null && component.builderTemplate.isPastable(data, component)) {
            $("#paste-element-btn").removeClass("disabled");
        }
        
        $("#iframe-wrapper").show();
    },
    
    /*
     * Used to decide what builder component use for the element data
     */
    parseDataToComponent : function(data) {
        var self = CustomBuilder.Builder;
        
        var component = null;
        if (data.className !== undefined) {
            component = self.getComponent(data.className);
        } else if (self.options.callbacks['parseDataToComponent'] !== undefined && self.options.callbacks['parseDataToComponent'] !== "") {
            component = CustomBuilder.callback(self.options.callbacks['parseDataToComponent'], [data]);
        }
        
        return component;
    },
    
    /*
     * Find the child elements of the element data
     */
    parseDataChildElements : function(data, component) {
        var self = CustomBuilder.Builder;
        
        if (data[component.builderTemplate.getChildsDataHolder(data, component)] !== undefined) {
            return data[component.builderTemplate.getChildsDataHolder(data, component)];
        } else if (self.options.callbacks['parseDataChildElements'] !== undefined && self.options.callbacks['parseDataChildElements'] !== "") {
            return CustomBuilder.callback(self.options.callbacks['parseDataChildElements'], [data]);
        }
        return null;
    },
    
    /*
     * Find the properties of the element data
     */
    parseElementProps : function(data) {
        if (data.properties !== undefined) {
            return data.properties;
        } else {
            return data;
        }
    },
    
    /*
     * Load/update/re-rendering child elements of the element data
     */
    loadAndUpdateChildElements: function(element, elementObj, component, deferreds) {
        var self = CustomBuilder.Builder;
        var elements = self.parseDataChildElements(elementObj, component);
        
        if (elements !== null && elements.length > 0) {
            var container = $(element);
            if (!$(element).is('[data-cbuilder-'+component.builderTemplate.getChildsContainerAttr(elementObj, component)+']')) {
                container = $(element).find('[data-cbuilder-'+component.builderTemplate.getChildsContainerAttr(elementObj, component)+']:eq(0)');
            }
            
            if ($(container).find("[data-cbuilder-classname]").length === 0) {  //empty container, just load it
                for (var i in elements) {
                    var childComponent = self.parseDataToComponent(elements[i]);
                    var temp = $('<div></div>');
                    $(container).append(temp);
                    
                    var select = false;
                    
                    self.renderElement(elements[i], temp, childComponent, select, deferreds);
                }
            } else { //compare and update
                var i = 0;
                $(container).find("> [data-cbuilder-classname]").each(function() {
                    var data = $(this).data("data");
                    var classname = $(this).data("cbuilder-classname");
                    var childComponent = self.parseDataToComponent(elements[i]);
                    var props = self.parseElementProps(elements[i]);
                    if ((data === undefined || data === null) && classname === childComponent.className) {
                        $(this).data("data", elements[i]);
                        
                        var id = props.id;
                        if (id === undefined && elements[i].id !== undefined) {
                            id = elements[i].id;
                        }
                        
                        $(this).attr("data-cbuilder-id", id);
                        
                        self.loadAndUpdateChildElements($(this), elements[i], childComponent, deferreds);
                    } else {
                        //TODO: if differrent, need add it?
                    }
                    
                    if ($(this).outerHeight(true) === 0) {
                        $(this).attr("data-cbuilder-invisible", "");
                    }
                    i++;
                });
            }
        }
    },
    
    /*
     * Prepare the iframe for canvas
     */
    _loadIframe: function (url, callback) {
        var self = this;
        self.iframe = this.documentFrame.get(0);
        self.iframe.src = url;

        return this.documentFrame.on("load", function ()
        {
            window.FrameWindow = self.iframe.contentWindow;
            window.FrameDocument = self.iframe.contentWindow.document;
            $("#element-highlight-box").hide();

            $(window.FrameWindow).off("scroll resize");
            $(window.FrameWindow).on("scroll resize", function (event) {
                self._updateBoxes();
            });

            return self._frameLoaded(callback);
        });
    },
    
    /*
     * Update the position of the highlight and select box
     */
    _updateBoxes : function() {
        var self = this;
        if (self.selectedEl)
        {
            var node = self.selectedEl;
            if (!self.selectedEl.is(":visible") || self.selectedEl.is("[data-cbuilder-uneditable]")) {
                var id = $(node).data('cbuilder-id');
                if (self.frameBody.find('[data-cbuilder-select="'+id+'"]:visible').length > 0) {
                    node = self.frameBody.find('[data-cbuilder-select="'+id+'"]:visible').first();
                }
            }
            var box = self.getBox(node);

            $("#element-select-box").css(
                {"top": box.top - self.frameDoc.scrollTop(),
                    "left": box.left - self.frameDoc.scrollLeft(),
                    "width": box.width,
                    "height": box.height
                });

            var actionsOffset = $("#element-select-box #element-actions").offset();
            var boxOffset = $("#element-select-box").offset();
            var namewidth = $("#element-select-name").outerWidth();

            if (actionsOffset.left < boxOffset.left + namewidth) {
                var newWidth = $("#element-select-box #element-actions").outerWidth() + namewidth + 15 - $("#element-select-box").outerWidth();
                if (newWidth > $("#element-select-box #element-actions").outerWidth() - 1) {
                    newWidth = $("#element-select-box #element-actions").outerWidth() - 1;
                }
                $("#element-select-box #element-actions").css("right", "-" + newWidth + "px");
            }
        }

        if (self.highlightEl)
        {
            var node = self.highlightEl;
            if (!self.highlightEl.is(":visible") || self.highlightEl.is("[data-cbuilder-uneditable]")) {
                var id = $(node).data('cbuilder-id');
                if (self.frameBody.find('[data-cbuilder-select="'+id+'"]:visible').length > 0) {
                    node = self.frameBody.find('[data-cbuilder-select="'+id+'"]:visible').first();
                }
            }
            var box = self.getBox(node);

            $("#element-highlight-box").css(
                {"top": box.top - self.frameDoc.scrollTop(),
                    "left": box.left - self.frameDoc.scrollLeft(),
                    "width": box.width,
                    "height": box.height
                });
        }
    },
    
    /*
     * Used to initialize the canvas iframe once it is  loaded
     */
    _frameLoaded : function(callback) {
		
        var self = CustomBuilder.Builder;

        self.frameDoc = $(window.FrameDocument);
        self.frameHtml = $(window.FrameDocument).find("html");
        self.frameBody = $(window.FrameDocument).find("body");
        self.frameHead = $(window.FrameDocument).find("head");

        //insert editor helpers like non editable areas
        self.frameHead.append('<link data-cbuilder-helpers href="' + CustomBuilder.contextPath + '/builder/editor-helpers.css" rel="stylesheet">');

        self._initHighlight();

        $(window).triggerHandler("cbuilder.iframe.loaded", self.frameDoc);
        
        if (callback)
            callback();
    },	
    
    /*
     * Used to get the element label of the highlight and select box
     */
    _getElementType: function (data, component) {
        var label = null;
        
        if (component.builderTemplate.getLabel) {
            label = component.builderTemplate.getLabel(data, component);
        }
        
        if (label === null || label === undefined || label === "") {
            label = component.label;
        }
        
        return label;
    },
    
    /*
     * Move the selected element up
     */
    moveNodeUp: function (node) {
        var self = CustomBuilder.Builder;
        
        if (!node) {
            node = self.selectedEl;
        }
        
        var elementObj = $(node).data("data");
        var component = self.parseDataToComponent(elementObj);
        
        var prev = $(node).prev("[data-cbuilder-classname]");
        if (prev.length > 0) {
            var parent = self.selectedEl.parent().closest("[data-cbuilder-classname]");
            if (parent.length === 0) {
                parent = self.selectedEl.closest("body");
            }
            var parentDataArray = $(parent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)];
            var oldIndex = $.inArray($(self.selectedEl).data("data"), parentDataArray);
            if (oldIndex !== -1) {
                parentDataArray.splice(oldIndex, 1);
            }
            
            $(prev).before(node);
            var newIndex = $.inArray($(prev).data("data"), parentDataArray);
            parentDataArray.splice(newIndex, 0, $(self.selectedEl).data("data"));
        } else {
            var parentArr = self.frameHtml.find('[data-cbuilder-'+component.builderTemplate.getParentContainerAttr(elementObj, component)+']');
            var index = parentArr.index($(node).closest('[data-cbuilder-'+component.builderTemplate.getParentContainerAttr(elementObj, component)+']'));
            if (index > 0) {
                var parent = self.selectedEl.parent().closest("[data-cbuilder-classname]");
                if (parent.length === 0) {
                    parent = self.selectedEl.closest("body");
                }
                var parentDataArray = $(parent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)];
                var oldIndex = $.inArray($(self.selectedEl).data("data"), parentDataArray);
                if (oldIndex !== -1) {
                    parentDataArray.splice(oldIndex, 1);
                }
                
                var newParent = $(parentArr[index - 1]).closest("[data-cbuilder-classname]");
                $(parentArr[index - 1]).append(node);
                parentDataArray = $(newParent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)];
                parentDataArray.push($(self.selectedEl).data("data"));
                
                self.checkVisible(parent);
                self.checkVisible(newParent);
            }
        }
        if (component.builderTemplate.afterMoved)
            component.builderTemplate.afterMoved(self.selectedEl, elementObj, component);
        
        self.selectNode(self.selectedEl);

        CustomBuilder.update();
        self.triggerChange();
    },
    
    /*
     * Move the selected element down
     */
    moveNodeDown: function (node) {
        var self = CustomBuilder.Builder;
        
        if (!node) {
            node = self.selectedEl;
        }
        
        var elementObj = $(node).data("data");
        var component = self.parseDataToComponent(elementObj);
        
        var next = $(node).next("[data-cbuilder-classname]");
        if (next.length > 0) {
            var parent = self.selectedEl.parent().closest("[data-cbuilder-classname]");
            if (parent.length === 0) {
                parent = self.selectedEl.closest("body");
            }
            var parentDataArray = $(parent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)];
            var oldIndex = $.inArray($(self.selectedEl).data("data"), parentDataArray);
            if (oldIndex !== -1) {
                parentDataArray.splice(oldIndex, 1);
            }
            
            $(next).after(node);
            var newIndex = $.inArray($(next).data("data"), parentDataArray) + 1;
            parentDataArray.splice(newIndex, 0, $(self.selectedEl).data("data"));
        } else {
            var parentArr = self.frameHtml.find('[data-cbuilder-'+component.builderTemplate.getParentContainerAttr(elementObj, component)+']');
            var index = parentArr.index($(node).closest('[data-cbuilder-'+component.builderTemplate.getParentContainerAttr(elementObj, component)+']'));
            if (index < parentArr.length - 1) {
                var parent = self.selectedEl.parent().closest("[data-cbuilder-classname]");
                if (parent.length === 0) {
                    parent = self.selectedEl.closest("body");
                }
                var parentDataArray = $(parent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)];
                var oldIndex = $.inArray($(self.selectedEl).data("data"), parentDataArray);
                if (oldIndex !== -1) {
                    parentDataArray.splice(oldIndex, 1);
                }
                
                var newParent = $(parentArr[index + 1]).closest("[data-cbuilder-classname]");
                $(parentArr[index + 1]).find('[data-cbuilder-classname]:eq(0)').before(node);
                parentDataArray = $(newParent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)];
                parentDataArray.splice(0, 0, $(self.selectedEl).data("data"));
                
                self.checkVisible(parent);
                self.checkVisible(newParent);
            }
        }
        if (component.builderTemplate.afterMoved)
            component.builderTemplate.afterMoved(self.selectedEl, elementObj, component);
        
        self.selectNode(self.selectedEl);

        CustomBuilder.update();
        self.triggerChange();
    },
    
    /*
     * Copy the selected element and paste a clone element after it
     */
    cloneNode:  function(node) {
        var self = CustomBuilder.Builder;
        
        if (!node) {
            node = self.selectedEl;
        }
        
        var elementObj = $.extend(true, {}, $(node).data("data"));
        self.component = self.parseDataToComponent(elementObj);
        
        self.updateElementId(elementObj);
        
        var parent = $(node).parent().closest("[data-cbuilder-classname]");
        if ($(parent).length === 0) {
            parent = $(node).closest("body");
        }
        var parentDataArray = $(parent).data("data")[self.component.builderTemplate.getParentDataHolder(elementObj, self.component)];
        var newIndex = $.inArray($(node).data("data"), parentDataArray) + 1;
        parentDataArray.splice(newIndex, 0, elementObj);
        
        var temp = $('<div></div>');
        $(node).after(temp);
        
        self.renderElement(elementObj, temp, self.component, true);
        
        CustomBuilder.update();
    },
    
    /*
     * Copy the selected element and save in cache
     */
    copyNode: function(node) {
        var self = CustomBuilder.Builder;
        
        if (!node) {
            node = self.selectedEl;
        }
        
        var data = $(node).data("data");
        var component = self.parseDataToComponent(data);
        
        CustomBuilder.copy(data, component.builderTemplate.getParentContainerAttr(data, component));
        
        self.selectNode(self.selectedEl);
        
        if (component.builderTemplate.isPastable(data, component)) {
            $("#paste-element-btn").removeClass("disabled");
        }
    },
    
    /*
     * Paste the copied element in cache. 
     * First check the copied element can place as children of the selected element,
     * else check can the copied element can place as sibling of the selected element
     */
    pasteNode: function(node) {
        var self = CustomBuilder.Builder;
        
        if (!node) {
            node = self.selectedEl;
            if (!node) {
                node = self.frameBody.find('[data-cbuilder-classname]:eq(0)');
            }
        }
        
        self.component = self.parseDataToComponent($(node).data("data"));
        
        var data = CustomBuilder.getCopiedElement();
        var copiedObj = $.extend(true, {}, data.object);
        var copiedComponent = self.parseDataToComponent(copiedObj);
        
        self.updateElementId(copiedObj);

        if (CustomBuilder.Builder.options.callbacks["pasteElement"] !== undefined && CustomBuilder.Builder.options.callbacks["pasteElement"] !== "") {
            CustomBuilder.callback(CustomBuilder.Builder.options.callbacks["pasteElement"], [node, $(node).data("data"), self.component, copiedObj, copiedComponent]);
        } else {
            self._pasteNode(node, copiedObj, copiedComponent);
        }
        
        CustomBuilder.update();
    },
    
    /*
     * Internal method to handle paste element
     */
    _pasteNode: function(element, copiedObj, copiedComponent) {
        var self = CustomBuilder.Builder;   
        
        var elementObj = $(element).data("data");
        var component = self.parseDataToComponent(elementObj);
        
        var temp = $(copiedComponent.builderTemplate.getPasteTemporaryNode(copiedObj, copiedComponent));
        
        var copiedParentContainerAttr = copiedComponent.builderTemplate.getParentContainerAttr(copiedObj, copiedComponent);
        if (component.builderTemplate.getParentDataHolder(elementObj, component) === copiedComponent.builderTemplate.getParentDataHolder(copiedObj, copiedComponent)
                && component.builderTemplate.getParentContainerAttr(elementObj, component) === copiedParentContainerAttr
                && !($(element).is("[data-cbuilder-"+copiedParentContainerAttr+"]") || $(element).find("[data-cbuilder-"+copiedParentContainerAttr+"]:eq(0)").length > 0)) {
            //paste as sibling
            var parent = $(element).parent().closest("[data-cbuilder-classname]");
            if ($(parent).length === 0) {
                parent = $(element).closest("body");
            }
            var parentDataArray = $(parent).data("data")[copiedComponent.builderTemplate.getParentDataHolder(copiedObj, copiedComponent)];
            var newIndex = $.inArray(elementObj, parentDataArray) + 1;
            parentDataArray.splice(newIndex, 0, copiedObj);

            $(element).after(temp);
        } else {
            //paste as child
            var parentDataArray = $(element).data("data")[copiedComponent.builderTemplate.getParentDataHolder(copiedObj, copiedComponent)];
            parentDataArray.push(copiedObj);
            
            var container = null;
            if ($(element).is("[data-cbuilder-"+copiedParentContainerAttr+"]")) {
                container = $(element);
            } else {
                container = $(element).find("[data-cbuilder-"+copiedParentContainerAttr+"]:eq(0)");
            }
            
            if (container.length > 0) {
                $(container).append(temp);
            }
        }
        
        self.component = copiedComponent;
        self.renderElement(copiedObj, temp, copiedComponent, true);
    },
    
    /*
     * Select an element in canvas
     */
    selectNode:  function(node) {
        var self = CustomBuilder.Builder;
        if (!node || $(node).is('[data-cbuilder-uneditable]'))
        {
            self.selectedEl = null;
            self.subSelectedEl = null;
            $("#element-select-box").hide();
            
            if ($("body").hasClass("property-editor-right-panel")) {
                $("body").addClass("no-right-panel");
                $("#right-panel .property-editor-container").remove();
                $("#copy-element-btn").addClass("disabled");
            }
                
            return;
        }

//        if (self.texteditEl && self.selectedEl.get(0) != node)
//        {
//            Vvveb.WysiwygEditor.destroy(self.texteditEl);
//            $("#select-box").removeClass("text-edit").find("#select-actions").show();
//            self.texteditEl = null;
//        }

        var target = $(node);
        var isSubSelect = false;
        if ($(node).is('[data-cbuilder-select]')) {
            var id = $(node).data('cbuilder-select');
            target = self.frameBody.find('[data-cbuilder-id="'+id+'"]');
            self.subSelectedEl = $(node);
            isSubSelect = true;
        }
        if (!target.is(":visible")) {
            var id = $(node).data('cbuilder-id');
            if (self.frameBody.find('[data-cbuilder-select="'+id+'"]:visible').length > 0) {
                node = self.frameBody.find('[data-cbuilder-select="'+id+'"]:visible');
            }
        }
        if (target)
        {
            self.selectedEl = target;

            try {
                var box = self.getBox(node);

                $("#element-select-box").css(
                    {
                        "top": box.top - self.frameDoc.scrollTop(),
                        "left": box.left - self.frameDoc.scrollLeft(),
                        "width": box.width,
                        "height": box.height,
                        "display": "block"
                    });
                $("#element-select-box #element-actions").css("right", "-1px");
                
                var data = target.data("data");
                self.selectedElData = data;
                var component = self.parseDataToComponent(data);
                
                if (!isSubSelect || (isSubSelect && component.builderTemplate.isSubSelectAllowActions(data, component))) {
                    $("#paste-element-btn").addClass("disabled");
                    if (component.builderTemplate.isPastable(data, component)) {
                        $("#paste-element-btn").removeClass("disabled");
                    }

                    $("#drag-btn").hide();
                    if (component.builderTemplate.isDraggable(data, component)) {
                        $("#drag-btn").show();
                    }
                    
                    $("#up-btn, #down-btn").hide();
                    if (component.builderTemplate.isMovable(data, component)) {
                        $("#up-btn, #down-btn").show();
                    }

                    $("#delete-btn").hide();
                    if (component.builderTemplate.isDeletable(data, component)) {
                        $("#delete-btn").show();
                    }

                    $("#copy-element-btn").addClass("disabled");
                    if (component.builderTemplate.isCopyable(data, component)) {
                        $("#copy-element-btn").removeClass("disabled");
                    }

                    $("#parent-btn").hide();
                    if (component.builderTemplate.isNavigable(data, component)) {
                        $("#parent-btn").show();
                    }
                    $("#element-select-box #element-actions").show();
                } else {
                    $("#element-select-box #element-actions").hide();
                }
                
                if ($("body").hasClass("property-editor-right-panel") && !$("body").hasClass("disable-select-edit")) {
                    $("body").removeClass("no-right-panel");
                    
                    var elementPropertiesHidden = false;
                    
                    if (component.builderTemplate.isSupportProperties(data, component)) {
                        var props = self.parseElementProps(data);
                        var className = data.className;
                        if (className === undefined) {
                            className = self.selectedEl.data("cbuilder-classname");
                        }
                        if (component.builderTemplate.customPropertiesData) {
                            props = component.builderTemplate.customPropertiesData(props, data, component);
                        }
                        CustomBuilder.editProperties(className, props, data, target);
                    } else {
                        elementPropertiesHidden = true;
                        $("#element-properties-tab-link").hide();
                        $("#right-panel #element-properties-tab").find(".property-editor-container").remove();
                    }
                    
                    if (component.builderTemplate.isSupportStyle(data, component)) {
                        var props = self.parseElementProps(data);
                        var className = data.className;
                        if (className === undefined) {
                            className = self.selectedEl.data("cbuilder-classname");
                        }
                        if (component.builderTemplate.customPropertiesData) {
                            props = component.builderTemplate.customPropertiesData(props, data, component);
                        }
                        
                        self.editStyles(props, target, data, component);
                    } else {
                        $("#style-properties-tab-link").hide();
                        $("#right-panel #style-properties-tab").find(".property-editor-container").remove();
                    }
                    
                    if (elementPropertiesHidden) {
                        $("#style-properties-tab-link a").trigger("click");
                    }
                }
                
                $("#element-select-name").html(this._getElementType(data, component));
                
                $("#element-select-box #element-options").html("");
                $("#element-select-box #element-bottom-actions").html("");
                
                if (component.builderTemplate.selectNode)
                    component.builderTemplate.selectNode(target, data, component);
                
                var actionsOffset = $("#element-select-box #element-actions").offset();
                var boxOffset = $("#element-select-box").offset();
                var namewidth = $("#element-select-name").outerWidth();
                
                if (actionsOffset.left < boxOffset.left + namewidth) {
                    var newWidth = $("#element-select-box #element-actions").outerWidth() + namewidth + 15 - $("#element-select-box").outerWidth();
                    if (newWidth > $("#element-select-box #element-actions").outerWidth() - 1) {
                        newWidth = $("#element-select-box #element-actions").outerWidth() - 1;
                    }
                    $("#element-select-box #element-actions").css("right", "-" + newWidth + "px");
                }
                if (actionsOffset.top <= 55) {
                    $("#element-select-box #element-select-name").css("top", "0px");
                    $("#element-select-box #element-actions").css("top", "0px");
                } else {
                    $("#element-select-box #element-select-name").css("top", "");
                    $("#element-select-box #element-actions").css("top", "");
                }
                
                $("#element-highlight-box").hide();
                self.highlightEl = null;
                
                self.selectedEl.trigger("builder.selected");
            } catch (err) {
                console.log(err);
                return false;
            }
        }
    },
    
    /*
     * Init the canvas highlight event
     * It handle the drag and drop moving as well
     */
    _initHighlight: function () {

        var self = CustomBuilder.Builder;

        self.frameHtml.on("mousemove touchmove", function (event) {
            var target = $(event.target);
            var isAlternativeDrop = false;
            if ($(target).closest("[data-cbuilder-alternative-drop]").length > 0) {
                isAlternativeDrop = true;
                if (!$(target).is("[data-cbuilder-select]")) {
                    target = $(event.target).closest("[data-cbuilder-select]");
                }
            } else {
                if (!$(target).is("[data-cbuilder-classname]")) {
                    target = $(event.target).closest("[data-cbuilder-classname]");
                }
                if ($(target).length === 0 && self.component !== undefined) {
                    target = $(event.target).closest("body[data-cbuilder-"+self.component.builderTemplate.getParentContainerAttr(self.data, self.component)+"]");
                }
            }
            if ($(target).length > 0)
            {
                if (self.isDragging)
                {
                    $("#element-highlight-box").hide();
                    var elementsContainer = $(event.target).closest("[data-cbuilder-"+self.component.builderTemplate.getParentContainerAttr(self.data, self.component)+"]");
                    
                    try {
                        if (event.originalEvent)
                        {
                            var x = (event.clientX || event.originalEvent.clientX);
                            var y = (event.clientY || event.originalEvent.clientY);
                            
                            if (target.parent().length > 0 && target.parent().is(elementsContainer)) {
                                //not container
                                var offset = target.offset();
                                var top = offset.top - $(self.frameDoc).scrollTop();
                                var dY = (target.outerHeight() / 4);
                                var left = offset.left  - $(self.frameDoc).scrollLeft();
                                var dX = (target.outerWidth() / 4);
                                
                                if (target.parent().is("[data-cbuilder-sort-horizontal]")) {
                                    if (x < (left + dX*2)) {
                                        target.before(self.dragElement);
                                    } else { 
                                        target.after(self.dragElement);
                                    }
                                } else {
                                    if (y < (top + dY) || (y < (top + dY * 2) && x < (left + dX*3)) || (y < (top + dY * 3) && x < (left + dX))) {
                                        target.before(self.dragElement);
                                    } else { 
                                        target.after(self.dragElement);
                                    }
                                }
                            } else {
                                var childs = elementsContainer.find('> [data-cbuilder-classname]');
                                if (isAlternativeDrop) {
                                    childs = elementsContainer.find('> [data-cbuilder-select]:visible');
                                }
                                
                                //is container
                                if (childs.length > 0) {
                                    //when has childs, find child at x,y
                                    var child = null;
                                    var offset = null;
                                    var top = null;
                                    var left =  null;
                                    
                                    childs.each(function(){
                                        if (child === null) {
                                            offset = $(this).offset();
                                            top = offset.top - $(self.frameDoc).scrollTop();
                                            left = offset.left  - $(self.frameDoc).scrollLeft();

                                            if (y < top + $(this).outerHeight() && x < left + $(this).outerWidth()) {
                                                child = $(this);
                                            }
                                        }
                                    });
                                    
                                    if (child !== null) {
                                        var dY = (child.outerHeight() / 4);
                                        var dX = (child.outerWidth() / 4);
                                        
                                        if (elementsContainer.is("[data-cbuilder-sort-horizontal]")) {
                                            if (x < (left + dX*2)) {
                                                child.before(self.dragElement);
                                            } else { 
                                                child.after(self.dragElement);
                                            }
                                        } else {
                                            if (y < (top + dY) || (y < (top + dY * 2) && x < (left + dX*3)) || (y < (top + dY * 3) && x < (left + dX))) {
                                                child.before(self.dragElement);
                                            } else { 
                                                child.after(self.dragElement);
                                            }
                                        }
                                    } else {
                                        if (elementsContainer.is('[data-cbuilder-prepend]')) {
                                            elementsContainer.prepend(self.dragElement);
                                        } else {
                                            elementsContainer.append(self.dragElement);
                                        }
                                    }
                                } else {
                                    //when empty
                                    if (elementsContainer.is('[data-cbuilder-prepend]')) {
                                        elementsContainer.prepend(self.dragElement);
                                    } else {
                                        elementsContainer.append(self.dragElement);
                                    }
                                }
                            }
                            if (self.component.builderTemplate.dragging) {
                                self.dragElement = self.component.builderTemplate.dragging(self.dragElement, self.component);
                                self.dragElement.css("border", "1px dashed #4285f4");
                            }
                        }

                        if (self.iconDrag)
                            self.iconDrag.css({'left': x + 238, 'top': y + 20});
                    } catch (err) {
                        console.log(err);
                        return false;
                    }
                } else if (!$(target).is(self.frameBody))
                {
                    self.highlight(target, event);
                } else {
                    $("#element-highlight-box").hide();
                }
            }
        });

        self.frameHtml.on("mouseup touchend", function (event) {
            if (self.isDragging)
            {
                self.isDragging = false;
                self.frameBody.removeClass("is-dragging");
                self.frameBody.find("[data-cbuilder-droparea]").removeAttr("data-cbuilder-droparea");
                
                if (self.iconDrag) {
                    self.iconDrag.remove();
                    self.iconDrag = null;
                }

                self.handleDropEnd();
            }
        });
//
//        self.frameHtml.on("dblclick", function (event) {
//
//            if (Vvveb.Builder.isPreview == false)
//            {
//                self.texteditEl = target = $(event.target);
//
//                Vvveb.WysiwygEditor.edit(self.texteditEl);
//
//                self.texteditEl.attr({'contenteditable': true, 'spellcheckker': false});
//
//                self.texteditEl.on("blur keyup paste input", function (event) {
//
//                    $("#select-box").css({
//                        "width": self.texteditEl.outerWidth(),
//                        "height": self.texteditEl.outerHeight()
//                    });
//                });
//
//                $("#select-box").addClass("text-edit").find("#select-actions").hide();
//                $("#highlight-box").hide();
//            }
//        });


        self.frameHtml.on("click", function (event) {
            var target = $(event.target);
            if (!$(target).is("[data-cbuilder-classname]")) {
                target = $(event.target).closest("[data-cbuilder-classname]");
            }
            if ($(target).is("[data-cbuilder-unselectable]")) {
                return false;
            }
            if ($(event.target).closest("[data-cbuilder-select]").length > 0) {
                target = $(event.target).closest("[data-cbuilder-select]");
            }
            if ($(target).length > 0)
            {
                event.stopPropagation();
                event.stopImmediatePropagation();
                self.selectNode(target);
            }
            event.preventDefault();
            return false;
        });

    },
    
    /*
     * Highlight an element in canvas
     */
    highlight : function(target, event) {
        var self = CustomBuilder.Builder;
        
        if ($(event.target).closest('[data-cbuilder-select]').length > 0) {
            target = $(event.target).closest('[data-cbuilder-select]');
        }
        
        if ($(target).length > 0 && !$(target).is(self.frameBody) && !$(target).is('[data-cbuilder-uneditable]')) {
            var box = self.getBox(target);
            
            $("#element-highlight-box").css(
                    {"top": box.top - self.frameDoc.scrollTop(),
                        "left": box.left - self.frameDoc.scrollLeft(),
                        "width": box.width,
                        "height": box.height,
                        "display": event.target.hasAttribute('contenteditable') ? "none" : "block",
                        "border": self.isDragging ? "1px dashed aqua" : "", //when dragging highlight parent with green
                    });

            var nameOffset = $("#element-highlight-box").offset();
            if (nameOffset.top <= 76) {
                $("#element-highlight-name").css("top", "0px");
            } else {
                $("#element-highlight-name").css("top", "");
            }
            
            var data = target.data("data");
            if (data === undefined && $(target).is('[data-cbuilder-select]')) {
                var id = $(target).data('cbuilder-select');
                data = self.frameBody.find('[data-cbuilder-id="'+id+'"]').data("data");
            }
            if (data !== undefined) {
                self.highlightEl = target;
                var component = self.parseDataToComponent(data);
                $("#element-highlight-name").html(self._getElementType(data, component));
            } else {
                $("#element-highlight-box").hide();
                self.highlightEl = null;
            }
        } else {
            $("#element-highlight-box").hide();
            self.highlightEl = null;
        }
    },

    /*
     * Initialize the select box buttons action
     */
    _initBox: function () {
        var self = this;

        $("#drag-btn").on("mousedown", function (event) {
            $("#element-select-box").hide();
            self.dragElement = self.selectedEl.css("position", "");
            self.isDragging = true;
            self.currentParent = self.selectedEl.parent().closest("[data-cbuilder-classname]");
            self.component = self.parseDataToComponent($(self.selectedEl).data("data"));
            
            self.currentParent = self.selectedEl.parent().closest("[data-cbuilder-classname]");
            self.component = self.parseDataToComponent($(self.selectedEl).data("data"));
            self.data = $(self.selectedEl).data("data");

            self.dragElement = self.selectedEl.css("position", "");
            self.dragElement.data("css-border", self.dragElement.css("border"));
            self.dragElement.css("border", "1px dashed #4285f4");

            if (self.component.builderTemplate.dragStart)
                self.dragElement = self.component.builderTemplate.dragStart(self.dragElement, self.component);

            self.isDragging = true;
            self.frameBody.addClass("is-dragging");
            self.frameBody.find("[data-cbuilder-"+self.component.builderTemplate.getParentContainerAttr(self.data, self.component)+"]").attr("data-cbuilder-droparea", "");

            event.preventDefault();
            return false;
        });

        $("#down-btn").on("click", function (event) {
            $("#element-select-box").hide();
            self.moveNodeDown();
            event.preventDefault();
            return false;
        });

        $("#up-btn").on("click", function (event) {
            $("#element-select-box").hide();
            self.moveNodeUp();
            event.preventDefault();
            return false;
        });

        $("#copy-btn").on("click", function (event) {
            $("#element-select-box").hide();
            self.copyNode();
            event.preventDefault();
            return false;
        });

        $("#paste-btn").on("click", function (event) {
            $("#element-select-box").hide();
            self.pasteNode();
            event.preventDefault();
            return false;
        });

        $("#parent-btn").on("click", function (event) {
            $("#element-select-box").hide();
            node = self.selectedEl.parent().closest("[data-cbuilder-classname]");
            self.selectNode(node);
            
            event.preventDefault();
            return false;
        });

        $("#delete-btn").on("click", function (event) {
            $("#element-select-box").hide();
            var elementObj = $(self.selectedEl).data("data");
            var component = self.parseDataToComponent(elementObj);
             
            var parent = self.selectedEl.parent().closest("[data-cbuilder-classname]");
            if (parent.length === 0) {
                parent = self.selectedEl.closest("body");
            }
            var parentDataArray = $(parent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)];
            var index = $.inArray($(self.selectedEl).data("data"), parentDataArray);
            if (index !== -1) {
                parentDataArray.splice(index, 1);
            }
            
            
            if (component.builderTemplate.unload)
                component.builderTemplate.unload($(self.selectedEl), elementObj, component);
            
            self.selectedEl.remove();
            self.selectNode(false);
            
            self.checkVisible(parent);
            
            CustomBuilder.update();
            self.triggerChange();

            event.preventDefault();
            return false;
        });
    },

    /*
     * Get builder component based on classname
     * Builder component are use to decide the bahavior of q component in canvas
     */
    getComponent : function(className) {
        var component = CustomBuilder.paletteElements[className];
        
        if (component === undefined) {
            return null;
        }
        
        if (component.builderTemplate === undefined || component.builderTemplate.builderReady === undefined) {
            if (component.builderTemplate === undefined) {
                component.builderTemplate = {};
            }
            component.builderTemplate = $.extend(true, {
                'render' : function(element, elementObj, component, callback) {
                    if (CustomBuilder.Builder.options.callbacks["renderElement"] !== undefined && CustomBuilder.Builder.options.callbacks["renderElement"] !== "") {
                        CustomBuilder.callback(CustomBuilder.Builder.options.callbacks["renderElement"], [element, elementObj, component, callback]);
                    } else if (callback) {
                        callback(element);
                    }
                },
                'unload' : function(element, elementObj, component) {
                    if (CustomBuilder.Builder.options.callbacks["unloadElement"] !== undefined && CustomBuilder.Builder.options.callbacks["unloadElement"] !== "") {
                        CustomBuilder.callback(CustomBuilder.Builder.options.callbacks["unloadElement"], [element, elementObj, component]);
                    }
                },
                'selectNode' : function(element, elementObj, component) {
                    if (CustomBuilder.Builder.options.callbacks["selectElement"] !== undefined && CustomBuilder.Builder.options.callbacks["selectElement"] !== "") {
                        CustomBuilder.callback(CustomBuilder.Builder.options.callbacks["selectElement"], [element, elementObj, component]);
                    }
                },
                'getDragHtml' : function(elementObj, component) {
                    return this.dragHtml;
                },
                'getHtml' : function(elementObj, component) {
                    return this.html;
                },
                'getParentContainerAttr' : function(elementObj, component) {
                    return this.parentContainerAttr;
                },
                'getChildsContainerAttr' : function(elementObj, component) {
                    return this.childsContainerAttr;
                },
                'getParentDataHolder' : function(elementObj, component) {
                    return "elements";
                },
                'getChildsDataHolder' : function(elementObj, component) {
                    return "elements";
                },
                'getPasteTemporaryNode' : function(elementObj, component) {
                    return '<div></div>';
                },
                'isSupportProperties' : function(elementObj, component) {
                    return this.supportProperties;
                },
                'isSupportStyle' : function(elementObj, component) {
                    return this.supportStyle;
                },
                'isDraggable' : function(elementObj, component) {
                    return this.draggable;
                },
                'isMovable' : function(elementObj, component) {
                    return this.movable;
                },
                'isDeletable' : function(elementObj, component) {
                    return this.deletable;
                },
                'isCopyable' : function(elementObj, component) {
                    return this.copyable;
                },
                'isNavigable' : function(elementObj, component) {
                    return this.navigable;
                },
                'isSubSelectAllowActions' : function(elementObj, component) {
                    return false;
                },
                'isPastable' : function(elementObj, component) {
                    var copied = CustomBuilder.getCopiedElement();
                    if (copied !== null && copied !== undefined) {
                        var copiedComponent = CustomBuilder.Builder.parseDataToComponent(copied.object);
                        if (copiedComponent !== null && copiedComponent !== undefined && component.builderTemplate.getChildsContainerAttr(elementObj, component) === copiedComponent.builderTemplate.getParentContainerAttr(copied.object, copiedComponent)) {
                            return true;
                        } else if (copiedComponent !== null && copiedComponent !== undefined && component.builderTemplate.getParentContainerAttr(elementObj, component) === copiedComponent.builderTemplate.getParentContainerAttr(copied.object, copiedComponent)) {
                            return true; //sibling
                        }
                    }
                    return false;
                },
                'getStylePropertiesDefinition' : function(elementObj, component) {
                    return this.stylePropertiesDefinition;
                },
                'parentContainerAttr' : 'elements',
                'childsContainerAttr' : 'elements',
                'stylePropertiesDefinition' : CustomBuilder.Builder.stylePropertiesDefinition(component.builderTemplate.stylePrefix),
                'supportProperties' : true,
                'supportStyle' : true,
                'draggable' : true,
                'movable' : true,
                'deletable' : true,
                'copyable' : true,
                'navigable' : true,
                'builderReady' : true
            }, component.builderTemplate);
            
            if (CustomBuilder.Builder.options.callbacks["initComponent"] !== undefined && CustomBuilder.Builder.options.callbacks["initComponent"] !== "") {
                CustomBuilder.callback(CustomBuilder.Builder.options.callbacks["initComponent"], [component]);
            }
        }
        
        return component;
    },

    /*
     * Initialize the drap and drop of elements in pallete
     */
    _initDragdrop: function () {

        var self = CustomBuilder.Builder;
        self.isDragging = false;

        $('.drag-elements-sidepane').on("mousedown touchstart", "ul > li > ol > li", function (event) {

            $this = $(this);
            if (self.iconDrag) {
                self.iconDrag.remove();
                self.iconDrag = null;
            }
            
            self.currentParent = null;
            self.component = self.getComponent($this.find("> div").attr("element-class"));
            self.data = null;
            
            var html = null;
            if (self.component.builderTemplate.getDragHtml){
                html = self.component.builderTemplate.getDragHtml(self.component);
            }
            if (html === undefined || html === null) {
                html = self.component.builderTemplate.getHtml(self.data, self.component);
            }

            self.dragElement = $(html);
            self.dragElement.css("border", "1px dashed #4285f4");

            if (self.component.builderTemplate.dragStart)
                self.dragElement = self.component.builderTemplate.dragStart(self.dragElement, self.component);

            self.isDragging = true;
            self.frameBody.addClass("is-dragging");
            self.frameBody.find("[data-cbuilder-"+self.component.builderTemplate.getParentContainerAttr(self.data, self.component)+"]").attr("data-cbuilder-droparea", "");
            
            self.iconDrag = $($this.html()).attr("id", "dragElement-clone").css('position', 'absolute');
            self.iconDrag.find("> a").remove();

            $('body').append(self.iconDrag);
            
            var x = (event.clientX || event.originalEvent.clientX);
            var y = (event.clientY || event.originalEvent.clientY);

            self.iconDrag.css({'left': x - 50, 'top': y - 45});

            event.preventDefault();
            return false;
        });
        
        $('.drag-elements-sidepane').on("mouseup touchend", "ul > li > ol > li", function (event) {
            self.isDragging = false;
            self.frameBody.removeClass("is-dragging");
            self.frameBody.find("[data-cbuilder-droparea]").removeAttr("data-cbuilder-droparea");
            
            if (self.iconDrag) {
                self.iconDrag.remove();
                self.iconDrag = null;
            }
            if (self.dragElement) {
                self.dragElement.remove();
                self.dragElement = null;
            }
        });

        $('body').on('mouseup touchend', function (event) {
            if (self.iconDrag && self.isDragging == true)
            {
                self.isDragging = false;
                self.frameBody.removeClass("is-dragging");
                self.frameBody.find("[data-cbuilder-droparea]").removeAttr("data-cbuilder-droparea");
                
                if (self.iconDrag) {
                    self.iconDrag.remove();
                    self.iconDrag = null;
                }
                
                var x = (event.clientX || event.originalEvent.clientX);
                var y = (event.clientY || event.originalEvent.clientY);
                
                var elementMouseIsOver = document.elementFromPoint(x, y);
                
                if (self.dragElement && elementMouseIsOver && elementMouseIsOver.tagName !== 'IFRAME') {
                    self.dragElement.remove();
                    self.dragElement = null;
                } else {
                    self.handleDropEnd();
                }
            }
        });

        $('body').on('mousemove touchmove', function (event) {
            if (self.iconDrag && self.isDragging == true)
            {
                var x = (event.clientX || event.originalEvent.clientX);
                var y = (event.clientY || event.originalEvent.clientY);

                self.iconDrag.css({'left': x - 50, 'top': y - 45});

                var elementMouseIsOver = document.elementFromPoint(x, y);

                //if drag elements hovers over iframe switch to iframe mouseover handler	
                if (elementMouseIsOver && elementMouseIsOver.tagName == 'IFRAME')
                {
                    self.frameBody.trigger("mousemove", event);
                    event.stopPropagation();
                    self.selectNode(false);
                }
            }
        });
    },
    
    /*
     * Called when a drop event end to decide it is a move or add new
     */
    handleDropEnd : function() {
        var self = CustomBuilder.Builder;
        
        if (self.component.builderTemplate.dropEnd)
            self.dragElement = self.component.builderTemplate.dropEnd(self.dragElement);
        
        if (self.dragElement.data("cbuilder-classname") === undefined && self.dragElement.data("cbuilder-select") === undefined) {
            self.addElement();
        } else {
            self.moveElement();
        }
        
        CustomBuilder.update();
    },
    
    /*
     * Add/render element to canvas when new element drop from pallete.
     * Also update the JSON definition
     */
    addElement : function() {
        var self = CustomBuilder.Builder;
        
        if (CustomBuilder.Builder.options.callbacks["addElement"] !== undefined && CustomBuilder.Builder.options.callbacks["addElement"] !== "") {
            CustomBuilder.callback(CustomBuilder.Builder.options.callbacks["addElement"], [self.component, self.dragElement]);
        } else {
            var classname = self.component.className;
            var properties = {};
            
            if (self.component.properties !== undefined) {
                properties = $.extend(true, properties, self.component.properties);
            }
            
            var elementObj = {
                className: classname,
                properties: properties
            };
            
            self.updateElementId(elementObj);
            
            
            var childsDataHolder = self.component.builderTemplate.getChildsDataHolder(elementObj, self.component);
            var elements = [];
            if (self.component.builderTemplate[childsDataHolder] !== undefined) {
                elements = $.extend(true, elements, self.component.builderTemplate[childsDataHolder]);
            }
            elementObj[childsDataHolder] = elements;

            var parent = $(self.dragElement).closest("[data-cbuilder-classname]");
            if ($(parent).length === 0) {
                parent = $(self.dragElement).closest("body");
            }
            var data = parent.data("data");

            var index = 0;
            var container = $(self.dragElement).parent().closest("[data-cbuilder-"+self.component.builderTemplate.getParentContainerAttr(elementObj, self.component)+"]");
            index = $(container).find("> *").index(self.dragElement);
            
            data[self.component.builderTemplate.getParentDataHolder(elementObj, self.component)].splice(index, 0, elementObj);

            self.renderElement(elementObj, self.dragElement, self.component);
        }
    },
    
    /*
     * Update element id to an unique value
     */
    updateElementId : function(elementObj) {
        var self = CustomBuilder.Builder;
        if (CustomBuilder.Builder.options.callbacks["updateElementId"] !== undefined && CustomBuilder.Builder.options.callbacks["updateElementId"] !== "") {
            CustomBuilder.callback(CustomBuilder.Builder.options.callbacks["updateElementId"], [elementObj]);
        } else {
            var props = self.parseElementProps(elementObj);
            props["id"] = CustomBuilder.uuid();
        }
        
        var component = self.parseDataToComponent(elementObj);
        var elements = elementObj[component.builderTemplate.getChildsDataHolder(elementObj, component)];
        
        if (elements !== undefined && elements.length > 0) {
            for (var i in elements) {
                self.updateElementId(elements[i]);
            }
        }
    },
    
    /*
     * update the JSON definition when an element is moved
     */
    moveElement : function() {
        var self = CustomBuilder.Builder;
        
        if (CustomBuilder.Builder.options.callbacks["moveElement"] !== undefined && CustomBuilder.Builder.options.callbacks["moveElement"] !== "") {
            CustomBuilder.callback(CustomBuilder.Builder.options.callbacks["moveElement"], [self.component, self.dragElement]);
        } else {
            self.dragElement.css("border", self.dragElement.data("css-border"));
        
            var elementObj = $(self.dragElement).data("data");
            var component = self.parseDataToComponent(elementObj);

            var parent = self.currentParent;
            if (parent.length === 0) {
                parent = self.selectedEl.closest("body");
            }
            var parentDataArray = $(parent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)];
            var oldIndex = $.inArray(elementObj, parentDataArray);
            if (oldIndex !== -1) {
                parentDataArray.splice(oldIndex, 1);
            }

            var newParent = $(self.dragElement).closest("[data-cbuilder-classname]");
            var newParentDataArray = $(newParent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)];
            var prev = $(self.dragElement).prev("[data-cbuilder-classname]");
            var newIndex = 0;
            if ($(prev).length > 0) {
                newIndex = $.inArray($(prev).data("data"), newParentDataArray) + 1;
            }
            parentDataArray.splice(newIndex, 0, elementObj);

            self.checkVisible(parent);
            self.checkVisible(newParent);
            self.checkVisible(self.selectedEl);
            self.triggerChange();
        }
    },
    
    /*
     * Re-render an element when an element is updated
     */
    updateElement : function(elementObj, element, deferreds) {
        var self = CustomBuilder.Builder;
        self.renderElement(elementObj, element,  self.parseDataToComponent(elementObj), true, deferreds);
    },
    
    /*
     * Rendering an element
     */
    renderElement : function(elementObj, element, component, selectNode, deferreds, callback) {
        var self = CustomBuilder.Builder;
        
        $("#element-select-box").hide();
        $("#element-highlight-box").hide();
        
        var isRoot = false;
        if (deferreds === null || deferreds === undefined || deferreds.length === 0) {
            deferreds = [];
            isRoot = true;
        }
        
        element.css("border", "");
        
        var d = $.Deferred();
        deferreds.push(d);
        
        var html = component.builderTemplate.getHtml(elementObj, component);
        if (html !== undefined) {
            var temp = $(html);
            
            //if properties has tagName
            var props = self.parseElementProps(elementObj);
            if (props.tagName !== undefined && props.tagName !== "") {
                var newTemp = document.createElement(props.tagName);
                attributes = temp[0].attributes;
                for (i = 0, len = attributes.length; i < len; i++) {
                    newTemp.setAttribute(attributes[i].nodeName, attributes[i].nodeValue);
                }
                temp = $(newTemp);
            }
            
            //loop properties for css class, style & attribute 
            self.handleStylingProperties(temp, props);
            
            element.replaceWith(temp);
            element = temp;
            
            var id = props.id;
            if (id === undefined && elementObj.id !== undefined) {
                id = elementObj.id;
            }
            
            $(element).attr("data-cbuilder-classname", component.className);
            $(element).attr("data-cbuilder-id", id);
            $(element).data("data", elementObj);

            self.loadAndUpdateChildElements(element, elementObj, component, deferreds);
            
            d.resolve();
        } else {
            component.builderTemplate.render(element, elementObj, component, function(newElement){
                var props = self.parseElementProps(elementObj);
                var id = props.id;
                if (id === undefined && elementObj.id !== undefined) {
                    id = elementObj.id;
                }
                
                if (newElement === undefined) {
                    newElement = element;
                }
                $(newElement).attr("data-cbuilder-classname", component.className);
                $(newElement).attr("data-cbuilder-id", id);
                $(newElement).data("data", elementObj);

                self.loadAndUpdateChildElements(newElement, elementObj, component, deferreds);

                element = newElement;
                d.resolve();
            });
        }
        
        if (isRoot) {
            $.when.apply($, deferreds).then(function() {
                self.checkVisible(element);
                self.checkVisible(element.parent().closest("[data-cbuilder-classname]"));

                if (selectNode) {
                    self.selectNode(element);
                }
                
                if (callback) {
                    callback();
                }

                self.triggerChange();
            });
        }
    },
    
    /*
     * Used to apply element styling based on properties
     */
    handleStylingProperties: function(element, properties, prefix, cssStyleClass) {
        element.removeAttr("data-cbuilder-mobile-invisible");
        element.removeAttr("data-cbuilder-tablet-invisible");
        element.removeAttr("data-cbuilder-desktop-invisible");
        if (cssStyleClass !== undefined && cssStyleClass !== null && cssStyleClass !== "") {
            element.find('> style[data-cbuilder-style="'+cssStyleClass+'"]').remove();
        }
        
        if (prefix === undefined) {
            prefix = "";
        } else {
            prefix += "-";
        }
        
        var desktopStyle = "";
        var tabletStyle = "";
        var mobileStyle = "";
        
        for (var property in properties) {
            if (properties.hasOwnProperty(property)) {
                if (property.indexOf(prefix+'attr-') === 0) {
                    var key = property.replace(prefix+'attr-', '');
                    element.attr(key, properties[property]);
                } else if (property.indexOf(prefix+'css-') === 0) {
                    if (properties[property] !== "") {
                        element.addClass(properties[property]);
                    }
                } else if (property.indexOf(prefix+'style-') === 0) {
                    var value = properties[property];
                    if (property.indexOf('-background-image') > 0) {
                        if (value.indexOf("#appResource.") === 0) {
                            value = value.replace("#appResource.", CustomBuilder.contextPath + '/web/app/' + CustomBuilder.appId + '/resources/');
                            value = value.substring(0, value.length -1);
                        }
                        value = "url('" + value + "')";
                    }
                    
                    if (property.indexOf(prefix+'style-mobile-') === 0) {
                        var key = property.replace(prefix+'style-mobile-', '');
                        mobileStyle += key + ":" + value + " !important;";
                        
                        if (key === "display" && value === "none") {
                            element.attr("data-cbuilder-mobile-invisible", "");
                        }
                    } else if (property.indexOf(prefix+'style-tablet-') === 0) {
                        var key = property.replace(prefix+'style-tablet-', '');
                        tabletStyle += key + ":" + value + " !important;";
                        
                        if (key === "display" && value === "none") {
                            element.attr("data-cbuilder-tablet-invisible", "");
                        }
                    } else {
                        var key = property.replace(prefix+'style-', '');
                        desktopStyle += key + ":" + value + " !important;";
                        
                        if (key === "display" && value === "none") {
                            element.attr("data-cbuilder-desktop-invisible", "");
                        }
                    }
                }
            }
        }
        
        var builderStyles = "";
        if (desktopStyle !== "" || tabletStyle !== "" || mobileStyle !== "") {
           var styleClass = cssStyleClass;
           if (styleClass === undefined || styleClass === null || styleClass === "") {
                styleClass = "builder-style-"+CustomBuilder.uuid();
                element.addClass(styleClass);
                styleClass = "." + styleClass;
           }
           
           builderStyles = "<style data-cbuilder-style='"+styleClass+"'>";
           if (desktopStyle !== "") {
               builderStyles += styleClass + "{" + desktopStyle + "} ";
           }
           if (tabletStyle !== "") {
               builderStyles += "@media (max-width: 991px) {" + styleClass + "{" + tabletStyle + "}} ";
           }
           if (mobileStyle !== "") {
               builderStyles += "@media (max-width: 767px) {" + styleClass + "{" + mobileStyle + "}} ";
           }
           builderStyles += "</style>";
           element.append(builderStyles);
        }

        //if has text content
        if (properties[prefix+"textContent"] !== undefined) {
            if (element.is('[data-cbuilder-textContent]')) {
                element.html(properties[prefix+"textContent"]);
            } else {
                element.find('[data-cbuilder-textContent]').html(properties[prefix+"textContent"]);
            }
        }
    },

    /*
     * Set html to canvas
     */
    setHtml: function (html)
    {
        window.FrameDocument.body.innerHTML = html;
    },

    /*
     * Add html to canvas head
     */
    setHead: function (head)
    {
        CustomBuilder.Builder.frameHead.append(head);
    },
    
    /*
     * Check an element is visible or not, if not show an invisible flag
     */
    checkVisible : function(node) {
        $(node).removeAttr("data-cbuilder-invisible");
        if ($(node).outerHeight() === 0) {
            $(node).attr("data-cbuilder-invisible", "");
        }
    },
    
    /*
     * Render the tree menu for element navigation. Used by tree viewer
     */
    renderTreeMenu: function(container, node) {
        var self = CustomBuilder.Builder;
        
        if (container.find("> ol").length === 0) {
            container.append('<ol></ol>');
        }
        
        var target = node;
        if (node === undefined) {
            target = self.frameBody;
        }
        
        $(target).find("> *").each(function() {
            if ($(this).is("[data-cbuilder-classname]") && !$(this).is("[data-cbuilder-uneditable]")) {
                var rid = "r" + (new Date().getTime());
                var data = $(this).data("data");
                var component = self.parseDataToComponent(data);
                var props = self.parseElementProps(data);
                
                var label = component.label;
                if (props.label !== undefined && props.label !== "") {
                    label = props.label;
                } else if (props.id !== undefined && props.id !== "") {
                    label = props.id;
                }
                var li = $('<li class="tree-viewer-item"><label>'+component.icon+' <a>'+label+'</a></label><input type="checkbox" id="'+rid+'" checked/></li>');
                $(li).data("node", $(this));
                
                $(this).off("builder.selected");
                $(this).on("builder.selected", function(event) {
                    $(".tree-viewer-item").removeClass("active");
                    $(li).addClass("active");
                    
                    event.stopPropagation();
                });
                
                if (self.selectedEl && self.selectedEl.is($(this))) {
                    $(li).addClass("active");
                }
                
                container.find("> ol").append(li);
                self.renderTreeMenu(li, $(this));
            } else {
                if (CustomBuilder.Builder.options.callbacks["renderTreeMenuAdditionalNode"] !== undefined && CustomBuilder.Builder.options.callbacks["renderTreeMenuAdditionalNode"] !== "") {
                    container = CustomBuilder.callback(CustomBuilder.Builder.options.callbacks["renderTreeMenuAdditionalNode"], [container, $(this)]);
                }
                self.renderTreeMenu(container, $(this));
            }
        });
        
        //cleaning & attach event
        if (node === undefined) {
            container.find("li").each(function(){
                if ($(this).find("> ol > li").length === 0) {
                    $(this).find("> ol").remove();
                    $(this).find("> input").remove();
                }
            });
            
            $(container).off("click", "li.tree-viewer-item > label");
            $(container).on("click", "li.tree-viewer-item > label", function (e) {
                node = $(this).parent().data("node");
                if (node !== undefined) {
                    self.frameHtml.animate({
                        scrollTop: $(node).offset().top - 25
                    }, 1000);

                    node.click();
                }
            });
        }
    },
    
    /*
     * Used to traverling through all the nodes and render additional html to the node.
     * Used by xray viwer and permission editor
     */
    renderNodeAdditional : function(type, node, level) {
        var self = CustomBuilder.Builder;
        
        var target = $(node);
        if (node === undefined) {
            target = self.frameBody;
            self.frameBody.addClass("show-node-details");
            level = 0;
            self.colorCount = 0;
        }
        
        var clevel = level;
        if (target.is("[data-cbuilder-classname]") && !target.is("[data-cbuilder-uneditable]")) {
            clevel++;
        }
        
        $(target).find("> *:not(.cbuilder-node-details)").each(function() {
            self.renderNodeAdditional(type, $(this), clevel);
        });
        
        if (target.is("[data-cbuilder-classname]") && !target.is("[data-cbuilder-uneditable]")) {
            var data = $(target).data("data");
            var component = self.parseDataToComponent(data);
            var detailsDiv = $("<div class='cbuilder-node-details cbuilder-details-"+type+"'></div>");
            $(target).prepend(detailsDiv);
            $(detailsDiv).addClass("cbuilder-node-details-level"+level);
            $(detailsDiv).addClass("cbuilder-node-details-color"+(self.colorCount++ % 16));
            $(detailsDiv).prepend("<div class=\"cbuilder-node-details-box\"></div><dl class=\"cbuilder-node-details-list\"></dl>");
            
            var dl = detailsDiv.find('dl');
            dl.append('<dt><i class="las la-cube" title="Type"></i></dt><dd>'+component.label+'</dd>');

            var props = self.parseElementProps(data);
            var id = props.id;
            if (id === undefined && data.id !== undefined) {
                id = data.id;
            }
            if (id !== undefined) {
                dl.append('<dt><i class="las la-id-badge" title="Id"></i></dt><dd>'+id+'</dd>');
            }
            
            var callback = function() {
                //check if negative margin top
                if ($(target).css("margin-top").indexOf("-") !== -1) {
                    $(target).addClass("cbuilder-node-details-reset-margin-top");
                }
                
                var box = self.getBox(target);
                var dBox = self.getBox(detailsDiv, 3);
                var targetOffset = target.offset();
                
                var offset = 0;
                if (targetOffset.top !== box.top) {
                    offset = targetOffset.top - box.top;
                }
                
                $(detailsDiv).find(".cbuilder-node-details-list").css({
                    "top" : (box.top - dBox.top + offset) + "px",
                    "left" : (box.left - dBox.left) + "px",
                    "right" : ((dBox.left + dBox.width) - (box.left + box.width)) + "px"
                });
                
                var height = $(detailsDiv).find(".cbuilder-node-details-list").outerHeight();
                var padding = height + (box.top - dBox.top + offset) + offset;
                
                $(detailsDiv).css("padding-top", padding + "px");

                $(detailsDiv).find(".cbuilder-node-details-box").css({
                    "top" : (box.top - dBox.top + offset) + "px",
                    "left" : (box.left - dBox.left) + "px",
                    "right" : ((dBox.left + dBox.width) - (box.left + box.width)) + "px",
                    "bottom" : (- (box.height + (box.top - dBox.top))) + "px"
                });
                
                $(detailsDiv).uitooltip({
                    position: { my: "left+15 center", at: "right center" }
                });
            };
            
            var method = component.builderTemplate["render" + type];
            if (method !== undefined) {
                component.builderTemplate["render" + type](detailsDiv, target, data, component, callback);
            } else if (CustomBuilder.Builder.options.callbacks["render" + type] !== undefined && CustomBuilder.Builder.options.callbacks["render" + type] !== "") {
                CustomBuilder.callback(CustomBuilder.Builder.options.callbacks["render" + type], [detailsDiv, target, data, component, callback]);
            } else {
                callback();
            }
        }
    },
    
    /*
     * Used to traverling through all the nodes and remove additional html added to the node.
     * Used by xray viwer and permission editor
     */
    removeNodeAdditional : function(node) {
        var self = CustomBuilder.Builder;
        
        var target = $(node);
        if (node === undefined) {
            target = self.frameBody;
            self.frameBody.removeClass("show-node-details");
            self.frameBody.find(".cbuilder-node-details").remove();
            self.frameBody.find(".cbuilder-node-details-reset-margin-top").removeClass("cbuilder-node-details-reset-margin-top");
        }
        
        $(target).find(".cbuilder-node-details-wrap").each(function() {
            $(this).find("> [data-cbuilder-classname]").unwrap();
        });
    },
    
    /*
     * Used to render permission rule on left panel. Used by permission editor
     */
    renderPermissionRules : function(container, ruleObject) {
        var self = CustomBuilder.Builder;
        
        container.find(".panel-header").append('<div class="btn-group responsive-btns float-right" role="group"></div>');
        container.find(".responsive-btns").append('<button class="btn btn-link btn-sm" title="'+get_advtool_msg("adv.permission.newRule")+'" id="new-rule-btn"><i class="las la-plus"></i></button>');
        container.find(".responsive-btns").append('<button class="btn btn-link btn-sm" title="'+get_advtool_msg("adv.permission.editRule")+'" id="edit-rule-btn"><i class="las la-pen"></i></button>');
        container.find(".responsive-btns").append('<button class="btn btn-link btn-sm" title="'+get_advtool_msg("adv.permission.deleteRule")+'" id="delete-rule-btn" style="display:none;"><i class="las la-trash"></i></button>');
        
        
        
        var rulesContainer = container.find(".permission-rules-container");
        rulesContainer.append("<div class=\"sortable\"></div>");
        
        if (ruleObject["permission_rules"] !== undefined) {
            for (var i in ruleObject["permission_rules"]) {
                self.renderRule(rulesContainer.find(".sortable"), ruleObject["permission_rules"][i]);
            }
        }
        
        //render default
        var defaultRule = self.renderRule(rulesContainer, ruleObject);
        self.setActiveRule(container, $(defaultRule));
        
        $(container).find(".sortable").sortable({
            opacity: 0.8,
            axis: 'y',
            handle: '.sort',
            tolerance: 'intersect',
            stop: function(event, ui){
                var newRules = [];

                $(rulesContainer).find(".sortable .permission_rule").each(function(){
                    newRules.push($(this).data("data"));
                });

                ruleObject["permission_rules"] = newRules;

                CustomBuilder.updateJson();
            }
        });
        
        $("#new-rule-btn").off("click");
        $("#new-rule-btn").on("click", function() {
            var rule = {
                permission_key : CustomBuilder.uuid(),
                permission_name : get_advtool_msg('adv.permission.unnamed'),
                permission : {
                    className : "",
                    properties : []
                }
            };

            if (ruleObject["permission_rules"] === undefined) {
                ruleObject["permission_rules"] = [];
            }
            ruleObject["permission_rules"].unshift(rule);

            var ruleElm = self.renderRule(rulesContainer.find(".sortable"), rule, true);
            self.setActiveRule(container, $(ruleElm));
            
            CustomBuilder.update();
        });
        
        $("#edit-rule-btn").off("click");
        $("#edit-rule-btn").on("click", function() {
            var rule = rulesContainer.find(".active");
        });
        
        $("#delete-rule-btn").off("click");
        $("#delete-rule-btn").on("click", function() {
            var rule = rulesContainer.find(".sortable .active");
            
            var key = $(rule).data("key");
            var index = -1;
            for (var i = 0; i < ruleObject["permission_rules"].length; i++) {
                if (ruleObject["permission_rules"][i]["permission_key"] === key) {
                    index = i;
                    break;
                }
            }
            if (index > -1) {
                ruleObject["permission_rules"].splice(index, 1);

                self.removeElementsPermission(key);
                $(rule).remove();

                if ($(rulesContainer).find(".sortable .permission_rule").length > 0) {
                    self.setActiveRule(container, $(rulesContainer).find(".sortable .permission_rule:eq(0)"));
                } else {
                    self.setActiveRule(container, $(rulesContainer).find(".permission_rule.default"));
                }

                CustomBuilder.update();
            }
        });
        
        container.off("click", ".permission_rule");
        container.on("click", ".permission_rule", function(){
            self.setActiveRule(container, $(this));
        });
    },
    
    /*
     * Render rule on left panel
     */
    renderRule : function(container, obj, prepend) {
        var isDefault = true;
        var key = "default";
        var name = get_advtool_msg('adv.permission.default');
        var pluginName = get_advtool_msg('adv.permission.noPlugin');
        
        if (obj['permission_key'] !== undefined) {
            isDefault = false;
            key = obj['permission_key'];
            name = obj['permission_name'];
        }
        if (obj['permission'] !== undefined && obj['permission']["className"] !== undefined) {
            var className = obj['permission']["className"];
            if (className !== "") {
                pluginName = CustomBuilder.availablePermission[className];
                
                if (pluginName === undefined) {
                    pluginName = className + "(" + get_advtool_msg('dependency.tree.Missing.Plugin') + ")";
                }
            }
        }
        var rule = $('<div class="permission_rule"><div class="sort"></div><div class="name"></div><div class="plugin"><span class="plugin_name"></span></div></div>');
        
        $(rule).data("key", key);
        $(rule).attr("id", "permission-rule-"+key);
        $(rule).data("data", obj);
        $(rule).find(".name").text(name);
        $(rule).find(".plugin_name").text(pluginName);
        
        if (!isDefault) {
            $(rule).find(".name").addClass("visible");
            
            if (prepend) {
                $(container).prepend(rule);
            } else {
                $(container).append(rule);
            }
            
            $(rule).find(".name").editable(function(value, settings){
                if (value === "") {
                    value = get_advtool_msg('adv.permission.unnamed');
                }
                if (obj['permission_name'] !== value) {
                    obj['permission_name'] = value;
                    CustomBuilder.updateJson();
                }
                return value;
            },{
                type      : 'text',
                tooltip   : '' ,
                select    : true ,
                style     : 'inherit',
                cssclass  : 'labelEditableField',
                onblur    : 'submit',
                rows      : 1,
                width     : '80%',
                minwidth  : 80,
                data: function(value, settings) {
                    if (value !== "") {
                        var div = document.createElement('div');
                        div.innerHTML = value;
                        var decoded = div.firstChild.nodeValue;
                        return decoded;
                    } else {
                        return value;
                    }
                }
            });
        } else {
            $(rule).addClass("default");
            $(container).append(rule);
        }
        
        return $(rule);
    },
    
    /*
     * Set active rule and render the permission options for all nodes
     */
    setActiveRule : function(container, rule) {
        container.find(".active").removeClass("active");
        rule.addClass("active");
        
        container.find("#delete-rule-btn").hide();
        if (!rule.hasClass("default")) {
            container.find("#delete-rule-btn").show();
        }
        
        CustomBuilder.Builder.removeNodeAdditional();
        CustomBuilder.Builder.renderNodeAdditional('Permission');
        
        CustomBuilder.Builder.permissionRuleKey = $(rule).data("key");
    },
    
    /*
     * Remove permission from all nodes based on key
     */
    removeElementsPermission : function(key) {
        var self = CustomBuilder.Builder;
        self.frameBody.find("[data-cbuilder-classname]").each(function(){
            var data = $(this).data("data");
            var props = self.parseElementProps(data);
            if (props["permission_rules"] !== undefined && props["permission_rules"][key] !== undefined) {
                delete props["permission_rules"][key];
            }
        });
    },
    
    /*
     * Calculate the box position and size of a node
     */
    getBox: function(node, level) {
        var self = CustomBuilder.Builder;
        
        if (level === undefined) {
            level = 0;
        }
        
        var offset = $(node).offset();
        var top = offset.top;
        var left = offset.left;
        var width = $(node).outerWidth();
        var height = $(node).outerHeight();
        
        if (level < 3) {
            $(node).find("> *:visible:not(.cbuilder-node-details)").each(function(){
                var cbox = self.getBox($(this), ++level);

                if (cbox.top > 0 && cbox.top < top) {
                    top = cbox.top;
                }
                if (cbox.left > 0 && cbox.left < left) {
                    left = cbox.left;
                }
                if (cbox.width > 0 && cbox.width > width) {
                    width = cbox.width;
                }
                if (cbox.height > 0 && cbox.height > height) {
                    height = cbox.height;
                }
            });
        }
        
        var box = {
            top : top,
            left : left,
            width : width,
            height : height
        };
        
        return box;
    },
    
    /*
     * Edit the element style on right panel
     */
    editStyles : function (elementProperties, element, elementObj, component) {
        // show property dialog
        var options = {
            appPath: "/" + CustomBuilder.appId + "/" + CustomBuilder.appVersion,
            contextPath: CustomBuilder.contextPath,
            propertiesDefinition : component.builderTemplate.getStylePropertiesDefinition(elementObj, component),
            propertyValues : elementProperties,
            showCancelButton:false,
            changeCheckIgnoreUndefined: true,
            editorPanelMode: true,
            closeAfterSaved: false,
            saveCallback: function(container, properties) {
                var d = $(container).find(".property-editor-container").data("deferred");
                d.resolve({
                    container :container, 
                    prevProperties : elementProperties,
                    properties : properties, 
                    elementObj : elementObj,
                    element : element
                });
            },
            validationFailedCallback: function(container, errors) {
                var d = $(container).find(".property-editor-container").data("deferred");
                d.resolve({
                    container :container, 
                    prevProperties : elementProperties,
                    errors : errors, 
                    elementObj : elementObj,
                    element : element
                });
            }
        };
        
        $("#style-properties-tab-link").show();
        $("#right-panel #style-properties-tab").find(".property-editor-container").remove();
        $("#right-panel #style-properties-tab").propertyEditor(options);
    },
    
    /*
     * Used to prepare the base element styling properties
     */
    stylePropertiesDefinition : function(prefix) {
        var self = CustomBuilder.Builder;
        
        if (self.stylePropertiesDefinitionObj === undefined) {
            self.stylePropertiesDefinitionObj = [];
            
            var destopProps = [
                {
                    title: get_cbuilder_msg("style.display"),
                    viewport : 'desktop',
                    properties:[
                        {
                            name : 'style-display',
                            label : get_cbuilder_msg("style.display"),
                            type : 'selectbox',
                            options : [
                                {value : '', label : get_cbuilder_msg("style.default")},
                                {value : 'block', label : get_cbuilder_msg("style.block")},
                                {value : 'inline', label : get_cbuilder_msg("style.inline")},
                                {value : 'inline-block', label : get_cbuilder_msg("style.inlineBlock")},
                                {value : 'none', label : get_cbuilder_msg("style.none")}
                            ]
                        },
                        {
                            name : 'style-position',
                            label : get_cbuilder_msg("style.position"),
                            type : 'selectbox',
                            options : [
                                {value : '', label : get_cbuilder_msg("style.default")},
                                {value : 'static', label : get_cbuilder_msg("style.static")},
                                {value : 'fixed', label : get_cbuilder_msg("style.fixed")},
                                {value : 'relative', label : get_cbuilder_msg("style.relative")},
                                {value : 'absolute', label : get_cbuilder_msg("style.absolute")}
                            ]
                        },
                        {
                            name : 'style-top',
                            label : get_cbuilder_msg("style.top"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-left',
                            label : get_cbuilder_msg("style.left"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-right',
                            label : get_cbuilder_msg("style.right"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-bottom',
                            label : get_cbuilder_msg("style.bottom"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-float',
                            label : get_cbuilder_msg("style.float"),
                            type : 'selectbox',
                            options : [
                                {value : '', label : get_cbuilder_msg("style.none")},
                                {value : 'left', label : get_cbuilder_msg("style.left")},
                                {value : 'right', label : get_cbuilder_msg("style.right")}
                            ]
                        },
                        {
                            name : 'style-background-color',
                            label : get_cbuilder_msg("style.backgroundColor"),
                            type : 'color'
                        },
                        {
                            name : 'style-color',
                            label : get_cbuilder_msg("style.color"),
                            type : 'color'
                        }
                    ]
                },
                {
                    title:get_cbuilder_msg("style.typography"),
                    viewport : 'desktop',
                    properties:[
                        {
                            name : 'style-font-size',
                            label : get_cbuilder_msg("style.fontSize"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-font-family',
                            label : get_cbuilder_msg("style.fontFamily"),
                            type : 'selectbox',
                            options : [
                                {value : '', label : 'Default'},
                                {value : 'Arial, Helvetica, sans-serif', label : 'Arial'},
                                {value : '\'Lucida Sans Unicode\', \'Lucida Grande\', sans-serif', label : 'Lucida Grande'},
                                {value : '\'Palatino Linotype\', \'Book Antiqua\', Palatino, serif', label : 'Palatino Linotype'},
                                {value : '\'Times New Roman\', Times, serif', label : 'Times New Roman'},
                                {value : 'Georgia, serif', label : 'Georgia, serif'},
                                {value : 'Tahoma, Geneva, sans-serif', label : 'Tahoma'},
                                {value : '\'Comic Sans MS\', cursive, sans-serif', label : 'Comic Sans'},
                                {value : 'Verdana, Geneva, sans-serif', label : 'Verdana'},
                                {value : 'Impact, Charcoal, sans-serif', label : 'Impact'},
                                {value : '\'Arial Black\', Gadget, sans-serif', label : 'Arial Black'},
                                {value : '\'Trebuchet MS\', Helvetica, sans-serif', label : 'Trebuchet'},
                                {value : '\'Courier New\', Courier, monospace', label : 'Courier New'},
                                {value : '\'Brush Script MT\', sans-serif', label : 'Brush Script'}
                            ]
                        },
                        {
                            name : 'style-font-weight',
                            label : get_cbuilder_msg("style.fontWeight"),
                            type : 'selectbox',
                            options : [
                                {value : '', label : get_cbuilder_msg("style.default")},
                                {value : '100', label : get_cbuilder_msg("style.thin")},
                                {value : '200', label : get_cbuilder_msg("style.extraLight")},
                                {value : '300', label : get_cbuilder_msg("style.light")},
                                {value : '400', label : get_cbuilder_msg("style.normal")},
                                {value : '500', label : get_cbuilder_msg("style.medium")},
                                {value : '600', label : get_cbuilder_msg("style.semiBold")},
                                {value : '700', label : get_cbuilder_msg("style.bold")},
                                {value : '800', label : get_cbuilder_msg("style.extraBold")},
                                {value : '900', label : get_cbuilder_msg("style.ultraBold")}
                            ]
                        },
                        {
                            name : 'style-text-align',
                            label : get_cbuilder_msg("style.textAlign"),
                            type : 'selectbox',
                            options : [
                                {value : '', label : get_cbuilder_msg("style.default")},
                                {value : 'left', label : get_cbuilder_msg("style.left")},
                                {value : 'center', label : get_cbuilder_msg("style.center")},
                                {value : 'right', label : get_cbuilder_msg("style.right")},
                                {value : 'justify', label : get_cbuilder_msg("style.justify")}
                            ]
                        },
                        {
                            name : 'style-line-height',
                            label : get_cbuilder_msg("style.lineHeight"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-letter-spacing',
                            label : get_cbuilder_msg("style.letterSpacing"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-text-decoration',
                            label : get_cbuilder_msg("style.textDecoration"),
                            type : 'selectbox',
                            options : [
                                {value : '', label : get_cbuilder_msg("style.default")},
                                {value : 'none', label : get_cbuilder_msg("style.none")},
                                {value : 'underline', label : get_cbuilder_msg("style.underline")},
                                {value : 'overline', label : get_cbuilder_msg("style.overline")},
                                {value : 'line-through', label : get_cbuilder_msg("style.lineThrough")},
                                {value : 'underline overline', label : get_cbuilder_msg("style.underlineOverline")}
                            ]
                        },
                        {
                            name : 'style-text-decoration-color',
                            label : get_cbuilder_msg("style.textDecorationColor"),
                            type : 'color'
                        },
                        {
                            name : 'style-text-decoration-style',
                            label : get_cbuilder_msg("style.textDecorationStyle"),
                            type : 'selectbox',
                            options : [
                                {value : '', label : get_cbuilder_msg("style.default")},
                                {value : 'solid', label : get_cbuilder_msg("style.solid")},
                                {value : 'wavy', label : get_cbuilder_msg("style.wavy")},
                                {value : 'dotted', label : get_cbuilder_msg("style.dotted")},
                                {value : 'dashed', label : get_cbuilder_msg("style.dashed")},
                                {value : 'double', label : get_cbuilder_msg("style.double")}
                            ]
                        }
                    ]
                },
                {
                    title:get_cbuilder_msg("style.size"),
                    viewport : 'desktop',
                    properties:[
                        {
                            name : 'style-width',
                            label : get_cbuilder_msg("style.width"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-height',
                            label : get_cbuilder_msg("style.height"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-min-width',
                            label : get_cbuilder_msg("style.minWidth"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-min-height',
                            label : get_cbuilder_msg("style.minHeight"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-max-width',
                            label : get_cbuilder_msg("style.maxWidth"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-max-height',
                            label : get_cbuilder_msg("style.maxHeight"),
                            type : 'number',
                            mode : 'css_unit'
                        }
                    ]
                },
                {
                    title:get_cbuilder_msg("style.margin"),
                    viewport : 'desktop',
                    properties:[
                        {
                            name : 'style-margin-top',
                            label : get_cbuilder_msg("style.top"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-margin-left',
                            label : get_cbuilder_msg("style.left"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-margin-right',
                            label : get_cbuilder_msg("style.right"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-margin-bottom',
                            label : get_cbuilder_msg("style.bottom"),
                            type : 'number',
                            mode : 'css_unit'
                        }
                    ]
                },
                {
                    title:get_cbuilder_msg("style.padding"),
                    viewport : 'desktop',
                    properties:[
                        {
                            name : 'style-padding-top',
                            label : get_cbuilder_msg("style.top"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-padding-left',
                            label : get_cbuilder_msg("style.left"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-padding-right',
                            label : get_cbuilder_msg("style.right"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-padding-bottom',
                            label : get_cbuilder_msg("style.bottom"),
                            type : 'number',
                            mode : 'css_unit'
                        }
                    ]
                },
                {
                    title:get_cbuilder_msg("style.border"),
                    viewport : 'desktop',
                    properties:[
                        {
                            name : 'style-border-style',
                            label : get_cbuilder_msg("style.style"),
                            type : 'selectbox',
                            options : [
                                {value : '', label : get_cbuilder_msg("style.default")},
                                {value : 'solid', label : get_cbuilder_msg("style.solid")},
                                {value : 'dotted', label : get_cbuilder_msg("style.dotted")},
                                {value : 'dashed', label : get_cbuilder_msg("style.dashed")},
                                {value : 'double', label : get_cbuilder_msg("style.double")}
                            ]
                        },
                        {
                            name : 'style-border-width',
                            label : get_cbuilder_msg("style.width"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-border-radius',
                            label : get_cbuilder_msg("style.radius"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-border-color',
                            label : get_cbuilder_msg("style.color"),
                            type : 'color'
                        },
                        {
                            label : get_cbuilder_msg("style.customWidth"),
                            type : 'header'
                        },
                        {
                            name : 'style-border-top-width',
                            label : get_cbuilder_msg("style.top"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-border-left-width',
                            label : get_cbuilder_msg("style.left"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-border-right-width',
                            label : get_cbuilder_msg("style.right"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-border-bottom-width',
                            label : get_cbuilder_msg("style.bottom"),
                            type : 'number',
                            mode : 'css_unit'
                        }
                    ]
                },
                {
                    title:get_cbuilder_msg("style.backgroundImage"),
                    viewport : 'desktop',
                    properties:[
                        {
                            name : 'style-background-image',
                            label : get_cbuilder_msg("style.image"),
                            type: 'image',
                            appPath: CustomBuilder.appPath,
                            allowInput : 'true',
                            isPublic : 'true',
                            imageSize : 'width:100px;height:100px;'
                        },
                        {
                            name : 'style-background-repeat',
                            label : get_cbuilder_msg("style.repeat"),
                            type : 'selectbox',
                            options : [
                                {value : '', label : get_cbuilder_msg("style.default")},
                                {value : 'repeat-x', label : get_cbuilder_msg("style.repeatX")},
                                {value : 'repeat-y', label : get_cbuilder_msg("style.repeatY")},
                                {value : 'no-repeat', label : get_cbuilder_msg("style.noRepeat")}
                            ]
                        },
                        {
                            name : 'style-background-size',
                            label : get_cbuilder_msg("style.size"),
                            type : 'selectbox',
                            options : [
                                {value : '', label : get_cbuilder_msg("style.default")},
                                {value : 'contain', label : get_cbuilder_msg("style.contain")},
                                {value : 'cover', label : get_cbuilder_msg("style.cover")}
                            ]
                        },
                        {
                            name : 'style-background-position-x',
                            label : get_cbuilder_msg("style.positionX"),
                            type : 'number',
                            mode : 'css_unit'
                        },
                        {
                            name : 'style-background-position-y',
                            label : get_cbuilder_msg("style.positionY"),
                            type : 'number',
                            mode : 'css_unit'
                        }
                    ]
                }
            ];
            
            for (var i in destopProps) {
                self.stylePropertiesDefinitionObj.push(destopProps[i]);
                self.stylePropertiesDefinitionObj.push(self.getViewportPropsPage(destopProps[i], "mobile", '<i class="viewport-icon la la-mobile-phone"></i> '+get_cbuilder_msg("cbuilder.mobile")+' | '));
                self.stylePropertiesDefinitionObj.push(self.getViewportPropsPage(destopProps[i], "tablet", '<i class="viewport-icon la la-tablet"></i> '+get_cbuilder_msg("cbuilder.tablet")+' | '));
            }
        }
        
        var styleProps = $.extend(true, [], self.stylePropertiesDefinitionObj);
        if (prefix !== null && prefix !== undefined && prefix !== "") {
            for (var p in styleProps) {
                for (var i in styleProps[p].properties) {
                    if (styleProps[p].properties[i].name) {
                        styleProps[p].properties[i].name = prefix + "-" + styleProps[p].properties[i].name;
                    }
                }
            }
        }
        
        return styleProps;
    },
    
    /*
     * Used to prepare the element styling properties option for different viewport
     */
    getViewportPropsPage : function(props, viewport, titlePrefix) {
        var newProps = $.extend(true, {}, props);
        newProps.viewport = viewport;
        newProps.title = titlePrefix + newProps.title;
        
        for (var i in newProps.properties) {
            if (newProps.properties[i].name) {
                newProps.properties[i].name = newProps.properties[i].name.replace('style-', 'style-' + viewport + '-');
            }
        }
        
        return newProps;
    },
    
    /*
     * Trigger a change when there is a canvas change happen
     */
    triggerChange : function() {
        setTimeout(function() {
            $(CustomBuilder.Builder.iframe).trigger("change.builder");
        }, 0);
    }
}

var isIE11 = !!window.MSInputMethodContext && !!document.documentMode;