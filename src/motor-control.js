// Import Paho MQTT - using global import for browser compatibility
// The paho-mqtt library will be available globally as Paho

export class MotorController {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.motorState = {
            isOn: false,
            speed: 0,
            direction: 'forward' // 'forward' or 'reverse'
        };
        
        // MQTT Topics - using single topic for all motor data
        this.topics = {
            motor: 'akuri/motor/control',  // Single topic for all motor data
            status: 'akuri/motor/status',
            log: 'akuri/motor/log'
        };
        
        // DOM Elements
        this.elements = {};
    }

    initialize() {
        console.log('Initializing Motor Controller');
        this.getDOMElements();
        this.setupEventListeners();
        this.updateUI();
        this.addLogEntry('Motor Control Panel initialized');
        console.log('Motor Controller initialized successfully');
    }

    getDOMElements() {
        this.elements = {
            // Connection elements
            connectionStatus: document.getElementById('connectionStatus'),
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            connectButton: document.getElementById('connectButton'),
            brokerUrl: document.getElementById('brokerUrl'),
            clientId: document.getElementById('clientId'),
            
            // Motor control elements
            speedSlider: document.getElementById('speedSlider'),
            speedValue: document.getElementById('speedValue'),
            powerButton: document.getElementById('powerButton'),
            powerStatus: document.getElementById('powerStatus'),
            directionButton: document.getElementById('directionButton'),
            directionStatus: document.getElementById('directionStatus'),
            
            // Log elements
            statusLog: document.getElementById('statusLog'),
            clearLogButton: document.getElementById('clearLogButton')
        };
    }

    setupEventListeners() {
        console.log('Setting up event listeners');
        console.log('Connect button element:', this.elements.connectButton);
        
        // MQTT Connection
        this.elements.connectButton.addEventListener('click', () => {
            console.log('Connect button clicked, isConnected:', this.isConnected);
            if (this.isConnected) {
                this.disconnect();
            } else {
                this.connect();
            }
        });

        // Motor Controls
        this.elements.speedSlider.addEventListener('input', (e) => {
            this.setSpeed(parseInt(e.target.value));
        });

        this.elements.powerButton.addEventListener('click', () => {
            this.toggleMotor();
        });

        this.elements.directionButton.addEventListener('click', () => {
            this.toggleDirection();
        });

        // Log management
        this.elements.clearLogButton.addEventListener('click', () => {
            this.clearLog();
        });

        // Enter key for MQTT settings
        this.elements.brokerUrl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.connect();
        });
        
        this.elements.clientId.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.connect();
        });
    }

    async connect() {
        console.log('Connect button clicked');
        const brokerUrl = this.elements.brokerUrl.value.trim();
        const clientId = this.elements.clientId.value.trim();

        console.log('Broker URL:', brokerUrl);
        console.log('Client ID:', clientId);

        if (!brokerUrl) {
            this.addLogEntry('Error: Please enter a broker URL');
            return;
        }

        if (!clientId) {
            this.addLogEntry('Error: Please enter a client ID');
            return;
        }

        try {
            // Check if Paho MQTT is loaded
            if (typeof Paho === 'undefined') {
                throw new Error('Paho MQTT library not loaded');
            }
            
            this.addLogEntry(`Connecting to MQTT broker: ${brokerUrl}`);
            this.updateConnectionStatus('connecting');

            // Parse broker URL for Paho MQTT
            let host, port, useSSL;
            if (brokerUrl.startsWith('ws://')) {
                const url = new URL(brokerUrl);
                host = url.hostname;
                port = parseInt(url.port) || 8000;
                useSSL = false;
            } else if (brokerUrl.startsWith('wss://')) {
                const url = new URL(brokerUrl);
                host = url.hostname;
                port = parseInt(url.port) || 8884;
                useSSL = true;
            } else if (brokerUrl.startsWith('mqtt://')) {
                const url = new URL(brokerUrl);
                host = url.hostname;
                port = parseInt(url.port) || 1883;
                useSSL = false;
            } else {
                throw new Error('Unsupported protocol. Use ws://, wss://, or mqtt://');
            }

            // Create Paho MQTT client
            this.client = new Paho.Client(host, port, clientId);
            
            // Set callback handlers
            this.client.onConnectionLost = (responseObject) => {
                this.isConnected = false;
                this.updateConnectionStatus('disconnected');
                this.addLogEntry(`Connection lost: ${responseObject.errorMessage}`);
            };

            this.client.onMessageArrived = (message) => {
                this.handleIncomingMessage(message.destinationName, message.payloadString);
            };

            // Connect to the broker
            this.client.connect({
                onSuccess: () => {
                    this.isConnected = true;
                    this.updateConnectionStatus('connected');
                    this.addLogEntry('Successfully connected to MQTT broker');
                    
                    // Subscribe to status topics
                    this.subscribeToTopics();
                    
                    // Publish initial state
                    this.publishMotorState();
                },
                onFailure: (error) => {
                    this.addLogEntry(`Connection failed: ${error.errorMessage}`);
                    this.updateConnectionStatus('error');
                },
                useSSL: useSSL,
                timeout: 10,
                keepAliveInterval: 60,
                cleanSession: true
            });

        } catch (error) {
            this.addLogEntry(`Connection failed: ${error.message}`);
            this.updateConnectionStatus('error');
        }
    }

    disconnect() {
        if (this.client && this.isConnected) {
            this.client.disconnect();
            this.client = null;
        }
        this.isConnected = false;
        this.updateConnectionStatus('disconnected');
        this.addLogEntry('Disconnected from MQTT broker');
    }

    subscribeToTopics() {
        if (!this.client || !this.isConnected) return;

        // Subscribe to status and log topics
        Object.values(this.topics).forEach(topic => {
            this.client.subscribe(topic, {
                onSuccess: () => {
                    this.addLogEntry(`Subscribed to topic: ${topic}`);
                },
                onFailure: (error) => {
                    this.addLogEntry(`Failed to subscribe to ${topic}: ${error.errorMessage}`);
                }
            });
        });
    }

    handleIncomingMessage(topic, message) {
        try {
            const data = JSON.parse(message);
            
            switch (topic) {
                case this.topics.status:
                    this.addLogEntry(`Status update: ${data.message}`);
                    break;
                case this.topics.log:
                    this.addLogEntry(`Motor log: ${data.message}`);
                    break;
                default:
                    this.addLogEntry(`Received on ${topic}: ${message}`);
            }
        } catch (error) {
            this.addLogEntry(`Received on ${topic}: ${message}`);
        }
    }

    setSpeed(speed) {
        this.motorState.speed = Math.max(0, Math.min(100, speed));
        this.updateUI();
        
        if (this.isConnected) {
            this.publishMotorState();
        }
        
        this.addLogEntry(`Speed set to ${this.motorState.speed}%`);
    }

    toggleMotor() {
        this.motorState.isOn = !this.motorState.isOn;
        this.updateUI();
        
        if (this.isConnected) {
            this.publishMotorState();
        }
        
        const status = this.motorState.isOn ? 'ON' : 'OFF';
        this.addLogEntry(`Motor turned ${status}`);
    }

    toggleDirection() {
        this.motorState.direction = this.motorState.direction === 'forward' ? 'reverse' : 'forward';
        this.updateUI();
        
        if (this.isConnected) {
            this.publishMotorState();
        }
        
        const direction = this.motorState.direction.toUpperCase();
        this.addLogEntry(`Direction changed to ${direction}`);
    }

    publishMotorState() {
        if (!this.client || !this.isConnected) return;

        const message = JSON.stringify({
            isOn: this.motorState.isOn,
            speed: this.motorState.speed,
            direction: this.motorState.direction,
            timestamp: new Date().toISOString()
        });

        this.client.publish(this.topics.motor, message, 0, false);
    }

    updateUI() {
        // Update speed display
        this.elements.speedValue.textContent = this.motorState.speed;
        this.elements.speedSlider.value = this.motorState.speed;

        // Update power button
        if (this.motorState.isOn) {
            this.elements.powerButton.classList.remove('off');
            this.elements.powerButton.classList.add('on');
            this.elements.powerButton.querySelector('.button-text').textContent = 'Turn Off';
            this.elements.powerStatus.textContent = 'Motor: ON';
        } else {
            this.elements.powerButton.classList.remove('on');
            this.elements.powerButton.classList.add('off');
            this.elements.powerButton.querySelector('.button-text').textContent = 'Turn On';
            this.elements.powerStatus.textContent = 'Motor: OFF';
        }

        // Update direction button
        if (this.motorState.direction === 'forward') {
            this.elements.directionButton.classList.remove('reverse');
            this.elements.directionButton.classList.add('forward');
            this.elements.directionButton.querySelector('.button-text').textContent = 'Forward';
            this.elements.directionButton.querySelector('.button-icon').textContent = '▶️';
            this.elements.directionStatus.textContent = 'Direction: FORWARD';
        } else {
            this.elements.directionButton.classList.remove('forward');
            this.elements.directionButton.classList.add('reverse');
            this.elements.directionButton.querySelector('.button-text').textContent = 'Reverse';
            this.elements.directionButton.querySelector('.button-icon').textContent = '◀️';
            this.elements.directionStatus.textContent = 'Direction: REVERSE';
        }

        // Update connect button
        if (this.isConnected) {
            this.elements.connectButton.textContent = 'Disconnect';
            this.elements.connectButton.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
        } else {
            this.elements.connectButton.textContent = 'Connect to MQTT';
            this.elements.connectButton.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
        }
    }

    updateConnectionStatus(status) {
        const statusIndicator = this.elements.statusIndicator;
        const statusText = this.elements.statusText;

        switch (status) {
            case 'connected':
                statusIndicator.classList.add('connected');
                statusText.textContent = 'Connected';
                break;
            case 'connecting':
                statusIndicator.classList.remove('connected');
                statusText.textContent = 'Connecting...';
                break;
            case 'error':
                statusIndicator.classList.remove('connected');
                statusText.textContent = 'Connection Error';
                break;
            default:
                statusIndicator.classList.remove('connected');
                statusText.textContent = 'Disconnected';
        }
    }

    addLogEntry(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        this.elements.statusLog.appendChild(logEntry);
        this.elements.statusLog.scrollTop = this.elements.statusLog.scrollHeight;
        
        // Keep only last 50 log entries
        const entries = this.elements.statusLog.querySelectorAll('.log-entry');
        if (entries.length > 50) {
            entries[0].remove();
        }
    }

    clearLog() {
        this.elements.statusLog.innerHTML = '<div class="log-entry">Log cleared</div>';
    }
}
