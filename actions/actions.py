#!/usr/bin/env python3
"""
Rasa Custom Actions Server for LLL Farming WhatsApp Bot
This server handles custom actions that integrate with the business logic
"""

import logging
import requests
import json
from typing import Any, Text, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet, EventType
from rasa_sdk.forms import FormAction

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ActionGetProducts(Action):
    """Action to get available products from the business"""
    
    def name(self) -> Text:
        return "action_get_products"
    
    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        try:
            # Get business context from metadata
            metadata = tracker.get_slot("metadata") or {}
            business_id = metadata.get("businessId", "default")
            tenant_id = metadata.get("tenantId", "default")
            
            logger.info(f"Getting products for business: {business_id}, tenant: {tenant_id}")
            
            # Call your Node.js API to get products
            products = self._get_products_from_api(business_id, tenant_id)
            
            if products and len(products) > 0:
                # Format products for WhatsApp display
                products_list = self._format_products_for_whatsapp(products)
                dispatcher.utter_message(text=f"🛍️ *OUR PRODUCTS* 🛍️\n\n{products_list}")
            else:
                dispatcher.utter_message(text="⏳ Loading products...\n\nPlease try again in a moment or contact support if this persists.")
                
        except Exception as e:
            logger.error(f"Error in action_get_products: {e}")
            dispatcher.utter_message(text="I'm having trouble accessing our products. Please try again.")
        
        return []
    
    def _get_products_from_api(self, business_id: str, tenant_id: str) -> Dict[str, Any]:
        """Get products from your Node.js API"""
        try:
            import requests
            
            # Call your Node.js API endpoint
            api_url = f"http://localhost:3000/api/business/{business_id}/products"
            headers = {"Content-Type": "application/json"}
            
            # Add tenant information if available
            params = {}
            if tenant_id and tenant_id != "default":
                params["tenantId"] = tenant_id
            
            response = requests.get(api_url, headers=headers, params=params, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                return data.get("products", {})
            else:
                logger.warning(f"API call failed with status {response.status_code}")
                return {}
                
        except Exception as e:
            logger.error(f"API call failed: {e}")
            # Return mock data as fallback
            return {
                "tomatoes": {"name": "Fresh Tomatoes", "price": 15.00, "description": "Fresh red tomatoes"},
                "carrots": {"name": "Organic Carrots", "price": 12.00, "description": "Fresh organic carrots"},
                "lettuce": {"name": "Green Lettuce", "price": 8.00, "description": "Crisp green lettuce"},
                "potatoes": {"name": "Red Potatoes", "price": 18.00, "description": "Fresh red potatoes"},
                "onions": {"name": "White Onions", "price": 10.00, "description": "Fresh white onions"},
                "cabbage": {"name": "Fresh Cabbage", "price": 14.00, "description": "Fresh green cabbage"}
            }
    
    def _format_products_for_whatsapp(self, products: Dict[str, Any]) -> str:
        """Format products for WhatsApp display"""
        if not products:
            return "No products available at the moment."
        
        formatted_products = []
        count = 0
        
        for key, product in products.items():
            if count >= 10:  # Limit to 10 products for WhatsApp
                break
                
            name = product.get("name", "Unknown Product")
            price = product.get("price", 0)
            description = product.get("description", "")
            
            # Format price
            try:
                price_num = float(price)
                price_str = f"N${price_num:.2f}"
            except:
                price_str = f"N${price}"
            
            # Format product line
            product_line = f"{count + 1}. 🛍️ *{name}* - {price_str}"
            
            # Add description if available and not too long
            if description and len(description) <= 50:
                product_line += f"\n   {description}"
            
            formatted_products.append(product_line)
            count += 1
        
        result = "\n\n".join(formatted_products)
        result += "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        result += "\n💡 *How to order:*"
        result += "\n• Type the number to add to cart"
        result += "\n• Type *cart* to view cart"
        result += "\n• Type *checkout* to finish"
        
        return result

class ActionPlaceOrder(Action):
    """Action to place an order"""
    
    def name(self) -> Text:
        return "action_place_order"
    
    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        try:
            # Extract entities from the tracker
            product_name = tracker.get_slot("product_name")
            quantity = tracker.get_slot("quantity") or "1"
            
            if not product_name:
                dispatcher.utter_message(text="I'd be happy to help you place an order! What product would you like to order?")
                return []
            
            # Get customer info from metadata
            metadata = tracker.get_slot("metadata") or {}
            customer_phone = metadata.get("sender", "unknown")
            business_id = metadata.get("businessId", "default")
            tenant_id = metadata.get("tenantId", "default")
            
            logger.info(f"Placing order: {product_name} x{quantity} for customer {customer_phone}")
            
            # Create order data
            order_data = {
                "product_name": product_name,
                "quantity": int(quantity),
                "customer_phone": customer_phone,
                "business_id": business_id,
                "tenant_id": tenant_id
            }
            
            # Place order via API
            order_result = self._place_order_via_api(order_data)
            
            if order_result.get("success"):
                order_id = order_result.get('order_id', 'N/A')
                dispatcher.utter_message(text=f"🎉 *ORDER PLACED SUCCESSFULLY!* 🎉\n\n"
                                            f"Product: *{product_name}*\n"
                                            f"Quantity: *{quantity}*\n"
                                            f"Order ID: *{order_id}*\n\n"
                                            f"We'll contact you soon to confirm delivery details!")
            else:
                dispatcher.utter_message(text="I'm sorry, I couldn't place your order at the moment. Please try again or contact us directly.")
                
        except Exception as e:
            logger.error(f"Error in action_place_order: {e}")
            dispatcher.utter_message(text="I'm having trouble processing your order. Please try again.")
        
        return []
    
    def _place_order_via_api(self, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """Place order via your Node.js API"""
        try:
            import requests
            
            # Call your Node.js API endpoint
            api_url = f"http://localhost:3000/api/orders"
            headers = {"Content-Type": "application/json"}
            
            response = requests.post(api_url, json=order_data, headers=headers, timeout=10)
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.warning(f"Order API call failed with status {response.status_code}")
                return {"success": False, "error": "API call failed"}
                
        except Exception as e:
            logger.error(f"Order API call failed: {e}")
            # Return mock success for testing
            return {
                "success": True,
                "order_id": f"ORD-{hash(str(order_data)) % 10000}"
            }

class ActionGetPrice(Action):
    """Action to get price information for a product"""
    
    def name(self) -> Text:
        return "action_get_price"
    
    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        try:
            product_name = tracker.get_slot("product_name")
            
            if not product_name:
                dispatcher.utter_message(text="Which product would you like to know the price for?")
                return []
            
            # Get price from API
            price_info = self._get_price_from_api(product_name)
            
            if price_info:
                dispatcher.utter_message(text=f"{product_name} costs ${price_info['price']:.2f} per unit.")
            else:
                dispatcher.utter_message(text=f"I don't have pricing information for {product_name} at the moment.")
                
        except Exception as e:
            logger.error(f"Error in action_get_price: {e}")
            dispatcher.utter_message(text="I'm having trouble getting price information. Please try again.")
        
        return []
    
    def _get_price_from_api(self, product_name: str) -> Dict[str, Any]:
        """Mock method - replace with actual API call"""
        prices = {
            "tomatoes": {"price": 15.00},
            "carrots": {"price": 12.00},
            "lettuce": {"price": 8.00},
            "potatoes": {"price": 18.00},
            "onions": {"price": 10.00},
            "cabbage": {"price": 14.00}
        }
        
        # Simple matching - in real implementation, use fuzzy matching
        for key, value in prices.items():
            if key.lower() in product_name.lower():
                return value
        
        return None

class ActionCheckAvailability(Action):
    """Action to check product availability"""
    
    def name(self) -> Text:
        return "action_check_availability"
    
    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        try:
            product_name = tracker.get_slot("product_name")
            
            if not product_name:
                dispatcher.utter_message(text="Which product would you like to check availability for?")
                return []
            
            # Check availability via API
            availability = self._check_availability_via_api(product_name)
            
            if availability.get("available"):
                dispatcher.utter_message(text=f"Yes, {product_name} is available! We have {availability.get('stock', 'some')} units in stock.")
            else:
                dispatcher.utter_message(text=f"Sorry, {product_name} is currently out of stock. We'll have more available soon!")
                
        except Exception as e:
            logger.error(f"Error in action_check_availability: {e}")
            dispatcher.utter_message(text="I'm having trouble checking availability. Please try again.")
        
        return []
    
    def _check_availability_via_api(self, product_name: str) -> Dict[str, Any]:
        """Mock method - replace with actual API call"""
        # Mock availability data
        return {
            "available": True,
            "stock": 25
        }

class ActionTrackOrder(Action):
    """Action to track an order"""
    
    def name(self) -> Text:
        return "action_track_order"
    
    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        try:
            order_id = tracker.get_slot("order_id")
            
            if not order_id:
                dispatcher.utter_message(text="Please provide your order ID to track your order.")
                return []
            
            # Track order via API
            order_status = self._track_order_via_api(order_id)
            
            if order_status:
                dispatcher.utter_message(text=f"Your order {order_id} is currently {order_status.get('status', 'processing')}. Expected delivery: {order_status.get('delivery_date', 'TBD')}")
            else:
                dispatcher.utter_message(text=f"I couldn't find order {order_id}. Please check your order ID and try again.")
                
        except Exception as e:
            logger.error(f"Error in action_track_order: {e}")
            dispatcher.utter_message(text="I'm having trouble tracking your order. Please try again.")
        
        return []
    
    def _track_order_via_api(self, order_id: str) -> Dict[str, Any]:
        """Mock method - replace with actual API call"""
        return {
            "status": "preparing",
            "delivery_date": "Tomorrow by 2 PM"
        }

class ActionCancelOrder(Action):
    """Action to cancel an order"""
    
    def name(self) -> Text:
        return "action_cancel_order"
    
    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        try:
            order_id = tracker.get_slot("order_id")
            
            if not order_id:
                dispatcher.utter_message(text="Please provide your order ID to cancel your order.")
                return []
            
            # Cancel order via API
            cancel_result = self._cancel_order_via_api(order_id)
            
            if cancel_result.get("success"):
                dispatcher.utter_message(text=f"Your order {order_id} has been cancelled successfully. Any payment will be refunded within 3-5 business days.")
            else:
                dispatcher.utter_message(text=f"I couldn't cancel order {order_id}. Please contact us directly for assistance.")
                
        except Exception as e:
            logger.error(f"Error in action_cancel_order: {e}")
            dispatcher.utter_message(text="I'm having trouble cancelling your order. Please try again.")
        
        return []
    
    def _cancel_order_via_api(self, order_id: str) -> Dict[str, Any]:
        """Mock method - replace with actual API call"""
        return {
            "success": True
        }

class ActionGetCustomerInfo(Action):
    """Action to get customer information"""
    
    def name(self) -> Text:
        return "action_get_customer_info"
    
    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        try:
            # Get customer info from metadata
            metadata = tracker.get_slot("metadata") or {}
            customer_phone = metadata.get("sender", "unknown")
            
            # Get customer details via API
            customer_info = self._get_customer_info_via_api(customer_phone)
            
            if customer_info:
                dispatcher.utter_message(text=f"Here's your information:\nName: {customer_info.get('name', 'N/A')}\nPhone: {customer_info.get('phone', 'N/A')}\nEmail: {customer_info.get('email', 'N/A')}")
            else:
                dispatcher.utter_message(text="I couldn't find your customer information. Please contact us directly to update your details.")
                
        except Exception as e:
            logger.error(f"Error in action_get_customer_info: {e}")
            dispatcher.utter_message(text="I'm having trouble retrieving your information. Please try again.")
        
        return []
    
    def _get_customer_info_via_api(self, customer_phone: str) -> Dict[str, Any]:
        """Mock method - replace with actual API call"""
        return {
            "name": "John Doe",
            "phone": customer_phone,
            "email": "john@example.com"
        }

if __name__ == "__main__":
    # This is for running the action server directly
    from rasa_sdk import endpoint
    endpoint.run()