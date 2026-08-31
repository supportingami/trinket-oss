module.exports = {
  apps: [
    {
      name: 'shell',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        SHELL_PORT: 8010,
        PYTHONPATH: '/home/trinket/python3',
        MPLBACKEND: 'module://trinket_backend',
        MPLCONFIGDIR: '/tmp'
      }
    },
    {
      name: 'manager',
      script: 'manager.js',
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
        SHELL_URL: 'http://127.0.0.1:8010',
        GENERATED_DIR: '/tmp/python-generated',
        GENERATED_URL: '/python3-generated'
      }
    }
  ]
};
