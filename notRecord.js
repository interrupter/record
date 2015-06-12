/* *
 *
 * Создает простой способ доступа к JSON данным на сервере.
 * Реализует основные REST методы save, get, list, update, delete
 * В дополнение к этому есть:
 * findBy - поиск по одному из полей
 * filter - поиск по ряду полей
 *
 * */
var notRecord_stdObjectProps = {
    writable: false,
    enumerable: false
};

function capitalizeFirstLetter(string) {
    'use strict';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

var DEFAULT_RECORD_ID_FIELD_NAME = '_id';
var DEFAULT_PAGE_NUMBER = 1;
var DEFAULT_PAGE_SIZE = 10;


var notRecord_Interface = {
    extendObject: function (obj1, obj2) {
        'use strict';
        var attrName = '';
        for (attrName in obj2) {
            if (obj2.hasOwnProperty(attrName)) {
                obj1[attrName] = obj2[attrName];
            }
        }
        return obj1;
    },

    parseLine: function (line, record, actionName) {
        'use strict';
        var i = 0,
            recordRE = ':record[',
            fieldName= '';
        while(line.indexOf(recordRE)>-1){
            fieldName = line.slice(line.indexOf(recordRE)+recordRE.length, line.indexOf(']')-line.indexOf(recordRE)+1);

            line = line.replace(':record[' + fieldName + ']', record.getAttr(fieldName));
        }
        line = line.replace(':modelName', record._notOptions.interfaceManifest.model);
        line = line.replace(':actionName', actionName);
        return line;
    },

    getURL: function (record, actionData, actionName) {
        'use strict';
        var line = this.parseLine(record._notOptions.interfaceManifest.url, record, actionName) + ((actionData.hasOwnProperty('postFix')) ? this.parseLine(actionData.postFix, record, actionName) : '');
        return line;
    },

    collectRequestData: function (record, actionData) {
        'use strict';
        var requestData = {},
            i = 0;
        if ((actionData.hasOwnProperty('data')) && typeof (actionData.data) !== 'undefined' && actionData.data !== null) {
            for (i = 0; i < actionData.data.length; i++) {
                var dataProviderName = 'get' + capitalizeFirstLetter(actionData.data[i]);
                if (dataProviderName in record) {
                    requestData = this.extendObject(requestData, record[dataProviderName]());
                }
            }
        }
        return requestData;
    },

    request: function (record, actionName, callbackSuccess, callbackError) {
        'use strict';
        console.log('request', actionName);
        var actionData = record._notOptions.interfaceManifest.actions[actionName];
        $.ajax(this.getURL(record, actionData, actionName), {
            method: actionData.method,
            dataType: 'json',
            data: this.collectRequestData(record, actionData),
            complete: function (data, code) {
                var result = [];
                data = data.responseJSON;
                if (code == "success") {

                    if (('isArray' in actionData) && actionData.isArray) {
                        $.each(data, function (index, item) {
                            result.push(new notRecord(record._notOptions.interfaceManifest, item));
                        });
                    } else {
                        result = new notRecord(record._notOptions.interfaceManifest, data);
                    }
                    callbackSuccess(result);
                }else{
                    if (typeof callbackError !== 'undefined' && callbackError!==null && code==="error") callbackError(data);
                }
                if ((typeof record._notOptions.interfaceManifest.showMessages !== 'undefined') && record._notOptions.interfaceManifest.showMessages) {
                    var msg = ((actionData.hasOwnProperty('messages') && actionData.messages.hasOwnProperty(code)) ? actionData.messages[code] : data.error);
                    if ((typeof msg !== 'undefined') && (msg != '')) {
                        $('.top-left').notify({
                            type: code=='success'?code:'danger',
                            message: {
                                text: msg
                            }
                        }).show();
                    }

                }

            }
        });
    }
};

/*
 *
 */

//создаем объект с заданым манифестом интерфейса, если есть данные, то добавляем в него
var notRecord = function (interfaceManifest, item) {
    'use strict';
    this._notOptions = {
        interfaceManifest: interfaceManifest,
        filter: {},
        pageNumber: DEFAULT_PAGE_NUMBER,
        pageSize: DEFAULT_PAGE_SIZE,
        fields: []
    };
    if (typeof item !== 'undefined' && item !== null) {
        notRecord_Interface.extendObject(this, item);
        this._notOptions.fields = Object.keys(item);
    }
    var that = this;
    $.each(this._notOptions.interfaceManifest.actions, function (index, actionManifest) {
        if (!(this.hasOwnProperty('$' + index))) {
            that['$' + index] = function (callbackSuccess, callbackError) {
                console.log('$' + index);
                (notRecord_Interface.request.bind(notRecord_Interface, this, index + '', callbackSuccess,callbackError)).call();
            }
        } else {
            console.error('interface manifest for ', interfaceManifest.model, ' conflict with notRecord property "', '$' + index, '" that alredy exists');
        }
    });
    return this;
};

Object.defineProperties(notRecord.prototype, {
    'modelName': {
        get: function () {
            'use strict';
            return this._notOptions.interfaceManifest.model;
        }
    },
    'interfaceManifest': {
        get: function () {
            'use strict';
            return this._notOptions.interfaceManifest;
        }
    }
});

notRecord.prototype.setParam = function (paramName, paramValue) {
    'use strict';
    this._notOptions[paramName] = paramValue;
    return this;
}

notRecord.prototype.getParam = function (paramName) {
    'use strict';
    return this._notOptions[paramName];
}

notRecord.prototype.getModelName = function () {
    'use strict';
    return (this._notOptions.hasOwnProperty('interfaceManifest')&&this._notOptions.interfaceManifest.hasOwnProperty('model'))?this._notOptions.interfaceManifest.model:null;
}


notRecord.prototype.setAttr = function (attrName, attrValue) {
    'use strict';
    var fields = this.getParam('fields');
    if (fields.indexOf(attrName)==-1) {
        fields.push(attrName);
        this.setParam('fields', fields);
    }
    this[attrName] = attrValue;
    return this;
}

notRecord.prototype.setAttrs = function (hash) {
    'use strict';
    var h;
    for(h in hash){
        this.setAttr(h, hash[h]);
    }
    return this;
}

notRecord.prototype.getAttr = function (attrName) {
    'use strict';
    if (this.getParam('fields').indexOf(attrName)>-1) {
        return this[attrName];
    } else {
        return undefined;
    }
}

notRecord.prototype.setFilter = function (filterData) {
    'use strict';
    this.setParam('filter', filterData);
    return this;
};

notRecord.prototype.getFilter = function () {
    'use strict';
    return this.getParam('filter');
};

notRecord.prototype.setPageNumber = function (pageNumber) {
    'use strict';
    this.setParam('pageNumber', pageNumber);
    return this;
};

notRecord.prototype.setPageSize = function (pageSize) {
    'use strict';
    this.setParam('pageSize', pageSize);
    return this;
};

notRecord.prototype.setPager = function (pageSize, pageNumber) {
    'use strict';
    this.setParam('pageSize', pageSize).setParam('pageNumber', pageNumber);
    return this;
};

notRecord.prototype.getPager = function () {
    'use strict';
    return {
        pageSize: this.getParam('pageSize'),
        pageNumber: this.getParam('pageNumber')
    };
};

notRecord.prototype.getRecord = function () {
    'use strict';
    var result = {},
        i = 0,
        fieldName,
        fields = this.getParam('fields');
    for (i = 0; i < fields.length; i++) {
        fieldName = fields[i];
        result[fieldName] = this.getAttr(fieldName);
    }
    return result;
};

notRecord.prototype.setFindBy = function (key, value) {
    'use strict';
    var obj = {};
    obj[key] = value;
    return this.setFilter(obj);
};
