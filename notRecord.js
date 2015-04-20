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
    //описание методов запросов
    /*api: {
        //корневой урл, :modelName название модели
        url: '/api/:modelName',
        //что можно делать
        actions: {
            //добавление новой записи
            save: {
                //метод
                method: 'POST',
                // что будем передавать в массиве POST, тут механизм простой у notRecord должен быть метод с названием getFoo,
                // в данном случае getRecord, его результаты будут переданы в POST запросе,
                // все результаты возвращаемые такими функциями должны быть объектами,
                // если их несколько, то они будут объединены в один объект
                data: ['record']
            },
            //получать по номеру записи
            get: {
                method: 'GET',
                //то что будет, прибавленно к URL
                postFix: '/:record[' + DEFAULT_RECORD_ID_FIELD_NAME + ']'
                    //:record[название поля из объекта], варианты /:record[_id]/:record[name] или /:record[date]
                    //поле должно существовать
            },
            //получить массив
            list: {
                method: 'GET',
                //применяются данные для постраницной выдачи
                data: ['pager'],
                isArray: true
            },
            //поиск по паре [название поля],[значение поля]
            findBy: {
                method: 'POST',
                postFix: '/findBy',
                data: ['filter']
            },
            //более комплексный вариант, пар может быть много
            filter: {
                method: 'POST',
                postFix: '/filter',
                data: ['pager', 'filter'],
                isArray: true
            },
            //сохранение изменений
            update: {
                method: 'POST',
                postFix: '/:record[' + DEFAULT_RECORD_ID_FIELD_NAME + ']'
            },
            //удаление записи с сервера
            'delete': {
                method: 'DELETE',
                postFix: '/:record[' + DEFAULT_RECORD_ID_FIELD_NAME + ']'
            }
        }
    },
*/
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
            recordRE = /\:record\[([\dA-z_\-]+)\]/gi,
            recordFields = line.match(recordRE);
        if (recordFields && (recordFields.length > 1)) {
            for (i = 1; i < recordFields.length; i++) {
                line = line.replace(':record[' + recordFields[i] + ']', record[recordFields[i]]);
            }
        }
        line = line.replace(':modelName', record.modelName);
        line = line.replace(':actionName', actionName);
        return line;
    },

    getURL: function (record, actionData, actionName) {
        'use strict';
        var line = this.parseLine(record.interfaceManifest.url, record) + ((actionData.hasOwnProperty('postFix')) ? this.parseLine(actionData.postFix, record) : '');
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

    request: function (record, actionName, callback) {
        'use strict';
        console.log('request', actionName);
        var actionData = record.interfaceManifest.actions[actionName];
        $.ajax(this.getURL(record, actionData, actionName), {
            method: actionData.method,
            dataType: 'json',
            data: this.collectRequestData(record, actionData),
            success: function (data) {
                var result = [];
                if (('isArray' in actionData) && actionData.isArray) {
                    $.each(data, function (index, item) {
                        result.push(new notRecord(record.interfaceManifest, item));
                    });
                } else {
                    result = new notRecord(record.interfaceManifest, data);
                }
                callback(result);
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
            that['$' + index] = function (callback) {
                console.log('$'+index);
                (notRecord_Interface.request.bind(notRecord_Interface, that, index+'', callback)).call();
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


notRecord.prototype.setAttr = function (attrName, attrValue) {
    'use strict';
    var fields = this.getParam('fields');
    if (!(attrName in fields)) {
        fields.push(attrName);
        this.setParam('fields', fields);
    }
    this[attrName] = attrValue;
    return this;
}

notRecord.prototype.getAttr = function (attrName) {
    'use strict';
    if (attrName in this.getParam('fields')) {
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
    var result = {};
    for (var fieldName in this.getParam('fields')) {
        if (this.hasOwnProperty(fieldName)) result[fieldName] = this[fieldName];
    }
    return result;
};

notRecord.prototype.setFindBy = function (key, value) {
    'use strict';
    var obj = {};
    obj[key] = value;
    return this.setFilter(obj);
};
