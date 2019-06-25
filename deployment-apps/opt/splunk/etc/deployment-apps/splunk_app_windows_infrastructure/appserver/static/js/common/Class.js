/*
 * Class is an abstraction to define classes and inheritance based on the
 * classes. It is a lightweight prototype chaining based inheritance abstraction.
 * 
 *  It is highly recommended to keep this implementation as simple as possible
 *  and only use classes in our apps when there is a demand for it. In regular
 *  cases use the conventional JS methodology. Examples for necessary conditions
 *  for using classes are: UnitTestBase class that all unit tests could extend from,
 *  generic classes like SyncTaskRunner that are implementation that may be extended
 *  for specific implementations in different scenarios, when multiple instances of an
 *  are to be created for a use case like two SyncTaskQueues.
 */

define(function() {
    var Class = {
        makeClass: function(classFn) {
            return classFn.prototype;
        },
        
        makeInheritedClass: function(baseClass, subClassFn) {
            subClassFn.prototype = new baseClass(); 
            subClassFn.prototype.constructor = subClassFn;
            
            return subClassFn.prototype;
        }
    };
    
    return Class;
});