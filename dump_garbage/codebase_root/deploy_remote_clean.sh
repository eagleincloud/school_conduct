#!/bin/bash
set -ex

TIMESTAMP=$(date +%s)
echo "Starting deployment at $TIMESTAMP"
mkdir -p /home/ec2-user/school-app/logs

if ! command -v python3.11 >/dev/null 2>&1; then
    echo "Installing Python 3.11..."
    sudo dnf install -y python3.11 python3.11-pip
fi

# 1. Deploy Backend
if [ -f "/home/ec2-user/backend.tar.gz" ]; then
    echo "Deploying Backend..."
    # Backup existing
    if [ -d "/home/ec2-user/school-app/backend" ]; then
        mv /home/ec2-user/school-app/backend /home/ec2-user/school-app/backend_backup_$TIMESTAMP
    fi
    mkdir -p /home/ec2-user/school-app/backend
    tar -xzf /home/ec2-user/backend.tar.gz -C /home/ec2-user/school-app/backend
    
    # Restore configuration
    if [ -f "/home/ec2-user/backend.env" ]; then
        mv /home/ec2-user/backend.env /home/ec2-user/school-app/backend/.env
    elif [ -f "/home/ec2-user/school-app/backend_backup_$TIMESTAMP/.env" ]; then
        cp /home/ec2-user/school-app/backend_backup_$TIMESTAMP/.env /home/ec2-user/school-app/backend/
    fi
    
    # Ensure virtual environment exists and uses Python 3.11
    if [ -d "/home/ec2-user/school-app/venv" ]; then
        VENV_VERSION=$(/home/ec2-user/school-app/venv/bin/python -c "import sys; print(sys.version_info[1])" 2>/dev/null || echo "0")
        if [ "$VENV_VERSION" -ne 11 ]; then
            echo "Removing old virtual environment (version 3.$VENV_VERSION)..."
            rm -rf /home/ec2-user/school-app/venv
        fi
    fi

    if [ ! -d "/home/ec2-user/school-app/venv" ]; then
        echo "Creating virtual environment with Python 3.11..."
        python3.11 -m venv /home/ec2-user/school-app/venv
    fi

    # Run migrations and collect static
    /home/ec2-user/school-app/venv/bin/pip install -r /home/ec2-user/school-app/backend/requirements.txt
    /home/ec2-user/school-app/venv/bin/python /home/ec2-user/school-app/backend/manage.py migrate
    /home/ec2-user/school-app/venv/bin/python /home/ec2-user/school-app/backend/manage.py collectstatic --no-input
    
    # Update Gunicorn systemd service configuration if present
    if [ -f "/home/ec2-user/gunicorn.service" ]; then
        echo "Updating Gunicorn service file in systemd..."
        sudo cp /home/ec2-user/gunicorn.service /etc/systemd/system/gunicorn.service
        sudo systemctl daemon-reload
    fi

    if [ -f "/home/ec2-user/biometric-tcp.service" ]; then
        echo "Updating biometric TCP service file in systemd..."
        sudo cp /home/ec2-user/biometric-tcp.service /etc/systemd/system/biometric-tcp.service
        sudo systemctl daemon-reload
        sudo systemctl enable biometric-tcp
        sudo systemctl restart biometric-tcp
    fi

    # Restart backend service
    sudo systemctl enable gunicorn
    sudo systemctl restart gunicorn
    echo "Backend deployed successfully."
fi

# 2. Deploy Frontend
if [ -f "/home/ec2-user/frontend.tar.gz" ]; then
    echo "Deploying Frontend..."
    # Backup existing
    if [ -d "/var/www/school-frontend" ]; then
        sudo mv /var/www/school-frontend /var/www/school-frontend_backup_$TIMESTAMP
    fi
    sudo mkdir -p /var/www/school-frontend
    sudo tar -xzf /home/ec2-user/frontend.tar.gz -C /var/www/school-frontend
    sudo chown -R nginx:nginx /var/www/school-frontend
    
    # Nginx reload/restart is handled in the Configure Nginx section below
    # sudo systemctl reload nginx
    echo "Frontend deployed successfully."
fi

# 3. Configure Nginx
if [ -f "/home/ec2-user/nginx.conf" ]; then
    echo "Updating main Nginx configuration..."
    sudo mv /home/ec2-user/nginx.conf /etc/nginx/nginx.conf
fi
if [ -f "/home/ec2-user/school.conf" ]; then
    echo "Updating site configuration..."
    sudo mv /home/ec2-user/school.conf /etc/nginx/conf.d/school.conf
fi

echo "Starting and enabling Nginx..."
sudo systemctl enable nginx
sudo systemctl restart nginx

# Cleanup uploaded archives and configurations
rm -f /home/ec2-user/backend.tar.gz
rm -f /home/ec2-user/frontend.tar.gz
rm -f /home/ec2-user/nginx.conf
rm -f /home/ec2-user/school.conf
rm -f /home/ec2-user/gunicorn.service
rm -f /home/ec2-user/biometric-tcp.service

echo "Deployment completed successfully!"
