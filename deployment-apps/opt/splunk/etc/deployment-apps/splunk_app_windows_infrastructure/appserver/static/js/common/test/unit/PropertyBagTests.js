define([
        'jquery',
        'underscore',
        'common/Class',
        'common/PropertyBag',
        'common/test/unit/TestHelpers',
        'common/test/unit/UnitTestBase'
        ],
        function(
            $,
            _,
            Class,
            PropertyBag,
            TestHelpers,
            UnitTestBase
            )
{
    var PropertyBagTests = function() {}
    
    var PropertyBagTestsClass = Class.makeInheritedClass(UnitTestBase, PropertyBagTests);
    
    PropertyBagTestsClass.setup = function() {
        this.defineTest(
            'PropertyBagTests',
            'Property Bag Tests',
            'property-bag-tests'
            );
    }
    
    PropertyBagTestsClass.run = function() {
        var that = this;
        
        var isTestsPassed = true;
        
        var testCases = [
            {
                fields: ['field1'],
                expectedSerializeResult: 'field1',
                
                searchResultsWithFieldValues: 'field1-value',
                expectedDeserializeResult: {'field1': 'field1-value'}
            },
            {
                fields: ['field1'],
                expectedSerializeResult: 'field1',
                
                searchResultsWithFieldValues: '',
                expectedDeserializeResult: {'field1': ''}
            },
            {
                fields: ['field1', 'field2', 'field3'],
                expectedSerializeResult: 'field1 . "|" . field2 . "|" . field3',
                    
                searchResultsWithFieldValues: 'field1-value|field2-value|field3-value',
                expectedDeserializeResult: {
                    'field1': 'field1-value',
                    'field2': 'field2-value',
                    'field3': 'field3-value'
                    }
            },
            {
                fields: ['field1', 'field2', 'field3'],
                expectedSerializeResult: 'field1 . "|" . field2 . "|" . field3',
                
                searchResultsWithFieldValues: '',
                expectedDeserializeResult: null
            },
            {
                fields: ['field1', 'field2', 'field3'],
                expectedSerializeResult: 'field1 . "|" . field2 . "|" . field3',
                
                searchResultsWithFieldValues: 'field1-value',
                expectedDeserializeResult: null
            },
            {
                fields: ['field1', 'field2', 'field3'],
                expectedSerializeResult: 'field1 . "|" . field2 . "|" . field3',
                
                searchResultsWithFieldValues: '||',
                expectedDeserializeResult: {
                    'field1': '',
                    'field2': '',
                    'field3': ''
                    }
            },
            {
                fields: ['field1', 'field2', 'field3'],
                expectedSerializeResult: 'field1 . "|" . field2 . "|" . field3',
                
                searchResultsWithFieldValues: 'field1-value||',
                expectedDeserializeResult: {
                    'field1': 'field1-value',
                    'field2': '',
                    'field3': ''
                    }
            },
            {
                fields: ['field1', 'field2', 'field3'],
                expectedSerializeResult: 'field1 . "|" . field2 . "|" . field3',
                
                searchResultsWithFieldValues: '|field2-value|',
                expectedDeserializeResult: {
                    'field1': '',
                    'field2': 'field2-value',
                    'field3': ''
                    }
            },
            {
                fields: ['field1', 'field2', 'field3'],
                expectedSerializeResult: 'field1 . "|" . field2 . "|" . field3',
                
                searchResultsWithFieldValues: '||field3-value',
                expectedDeserializeResult: {
                    'field1': '',
                    'field2': '',
                    'field3': 'field3-value'
                    }
            },
            {
                fields: ['field1'],
                expectedSerializeResult: 'field1',
                
                searchResultsWithFieldValues: null,
                expectedDeserializeResult: null
            },
            {
                fields: ['field1'],
                expectedSerializeResult: 'field1',
                
                searchResultsWithFieldValues: undefined,
                expectedDeserializeResult: null
            }
            ];
        
        _.each(testCases, function(testCase, index) {
            that.emitTestProgress('Verifying test case #' + (index + 1));
            
            var propertyBag = new PropertyBag(testCase.fields);
            
            if (_.isUndefined(propertyBag) || _.isNull(propertyBag)) {
                that.emitTestError('Could not create property bag.');
                
                isTestsPassed = false;
                return;
            }
            
            var serializedSearchPhrase = propertyBag.serializeToSearchPhrase();
            if (serializedSearchPhrase === testCase.expectedSerializeResult) {
                that.emitTestProgress(
                    'Serialized search phrase for ' + testCase.fields + ' is ' +
                    testCase.expectedSerializeResult + ' as expected.'
                    );
            } else {
                that.emitTestError(
                    'Serialized search phrase expected is' + testCase.expectedSerializeResult +
                    ' but propertyBag returned ' + serializedSearchPhrase
                    );
                
                isTestsPassed = false;
                return;
            }
            
            var deserializedValues = propertyBag.deserialize(testCase.searchResultsWithFieldValues);
            if (_.isEqual(deserializedValues, testCase.expectedDeserializeResult)) {
                that.emitTestProgress(
                    'Deserialize of ' + testCase.searchResultsWithFieldValues + ' returned ' + 
                    (_.isNull(testCase.expectedDeserializeResult) ? 'null' : JSON.stringify(testCase.expectedDeserializeResult)) +
                    ' as expected.'
                    );
            } else {

                that.emitTestError(
                    'Deserialized search values expected are ' + 
                    (_.isNull(testCase.expectedDeserializeResult) ? 'null' : JSON.stringify(testCase.expectedDeserializeResult)) +
                    ' but propertyBag returned ' + 
                    (_.isNull(deserializedValues) ? 'null' : JSON.stringify(deserializedValues))
                    );
                
                isTestsPassed = false;
                return;
            }  
        }); 
        
        if (isTestsPassed) {
            this.emitTestPassed();
        } else {
            this.emitTestFailed();
        }
    }
    
    PropertyBagTestsClass.cleanup = function() {
    }

    return PropertyBagTests;
});