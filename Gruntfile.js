module.exports = function(grunt) {
  // Configuration goes here
  grunt.initConfig({
    nodeunit: {
      all: ['tests/*_test.js']
    }
  });

  // Load plugins here
  grunt.loadNpmTasks('grunt-contrib');

  // Define your tasks here
  grunt.registerTask('test', function(file) {
    if (file) grunt.config('nodeunit.all', 'tests/' + file + '_test.js');
      grunt.task.run('nodeunit');
  });

};
