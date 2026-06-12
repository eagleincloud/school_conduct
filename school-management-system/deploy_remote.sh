#!/bin/bash
set -ex

TIMESTAMP=$(date +%s)
echo "Starting deployment at $TIMESTAMP"

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
    if [ -f "/home/ec2-user/school-app/backend_backup_$TIMESTAMP/.env" ]; then
        cp /home/ec2-user/school-app/backend_backup_$TIMESTAMP/.env /home/ec2-user/school-app/backend/
    fi
    
    # Run migrations and collect static
    /home/ec2-user/school-app/venv/bin/pip install -r /home/ec2-user/school-app/backend/requirements.txt
    /home/ec2-user/school-app/venv/bin/python /home/ec2-user/school-app/backend/manage.py migrate
    /home/ec2-user/school-app/venv/bin/python /home/ec2-user/school-app/backend/manage.py collectstatic --no-input
    
    # Restart backend service
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
    
    sudo systemctl reload nginx
    echo "Frontend deployed successfully."
fi

# Cleanup uploaded archives
rm -f /home/ec2-user/backend.tar.gz
rm -f /home/ec2-user/frontend.tar.gz
echo "Deployment completed successfully!"
