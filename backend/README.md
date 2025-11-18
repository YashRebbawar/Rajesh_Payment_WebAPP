# PrintFree Backend

Flask-based backend for the PrintFree trading account services application.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
python app.py
```

3. Access the application at `http://localhost:5000`

## Routes

- `/` - Landing page
- `/accounts` - Account selection page

## Project Structure

```
backend/
├── app.py              # Main Flask application
├── requirements.txt    # Python dependencies
├── templates/          # Jinja2 templates
│   ├── base.html      # Base template
│   ├── landing.html   # Landing page
│   └── accounts.html  # Account selector
└── static/            # Static assets
    └── css/
        └── style.css  # Application styles
```