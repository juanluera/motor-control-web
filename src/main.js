import { MotorController } from './motor-control.js';

// Initialize the motor controller when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for Paho MQTT to load
    setTimeout(() => {
        const motorController = new MotorController();
        motorController.initialize();
    }, 100);
});
