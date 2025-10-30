#!/usr/bin/env python3
"""
MVP: Fast Intent Classification for WhatsApp Bot
Loads sklearn model and classifies messages
"""

import sys
import json
import os
import tarfile
import pickle
import tempfile
from pathlib import Path

def load_model_for_tenant(tenant_id):
    """Load the latest trained model for a tenant"""
    try:
        # Find the model directory
        models_dir = Path(f"./rasa-models/{tenant_id}/models")
        
        if not models_dir.exists():
            return None
            
        # Find the latest .tar.gz file
        model_files = list(models_dir.glob("*.tar.gz"))
        if not model_files:
            return None
            
        # Get the most recent model
        latest_model = max(model_files, key=os.path.getctime)
        
        # Extract the tar.gz file
        with tempfile.TemporaryDirectory() as temp_dir:
            with tarfile.open(latest_model, 'r:gz') as tar:
                tar.extractall(temp_dir)
                
            # Look for pickle files
            temp_path = Path(temp_dir)
            pickle_files = list(temp_path.rglob("*.pkl"))
            
            if not pickle_files:
                return None
                
            # Load the model (assuming first pickle file is the main model)
            with open(pickle_files[0], 'rb') as f:
                model_data = pickle.load(f)
                
            return model_data
            
    except Exception as e:
        print(f"Error loading model: {e}", file=sys.stderr)
        return None

def classify_message(message, tenant_id):
    """Classify a message using the trained model"""
    try:
        # Load model
        model_data = load_model_for_tenant(tenant_id)
        
        if not model_data:
            return {
                "success": False,
                "error": "Model not found",
                "intent": "fallback",
                "confidence": 0.0
            }
        
        # Extract vectorizer and classifier
        vectorizer = model_data.get('vectorizer')
        classifier = model_data.get('classifier')
        
        if not vectorizer or not classifier:
            return {
                "success": False,
                "error": "Model components not found",
                "intent": "fallback", 
                "confidence": 0.0
            }
        
        # Vectorize the message
        message_vector = vectorizer.transform([message])
        
        # Predict intent
        intent = classifier.predict(message_vector)[0]
        
        # Get confidence scores
        probabilities = classifier.predict_proba(message_vector)[0]
        confidence = max(probabilities)
        
        return {
            "success": True,
            "intent": intent,
            "confidence": float(confidence),
            "all_probabilities": {
                label: float(prob) 
                for label, prob in zip(classifier.classes_, probabilities)
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "intent": "fallback",
            "confidence": 0.0
        }

def main():
    """Main function for command line usage"""
    if len(sys.argv) != 3:
        print(json.dumps({
            "success": False,
            "error": "Usage: python classify.py <tenant_id> <message>"
        }))
        sys.exit(1)
    
    tenant_id = sys.argv[1]
    message = sys.argv[2]
    
    result = classify_message(message, tenant_id)
    print(json.dumps(result))

if __name__ == "__main__":
    main()










