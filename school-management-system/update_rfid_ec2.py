import os
import sys
import django

backend_path = "/home/ec2-user/school-app/backend"
sys.path.append(backend_path)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from students.models import StudentProfile
from tenants.models import School
from django.db import transaction

records = [
  {
    "sr": "3221",
    "name": "Aarohi Sharma",
    "rfid": "1"
  },
  {
    "sr": "2902",
    "name": "Advaita Kesarwani",
    "rfid": "2"
  },
  {
    "sr": "3569",
    "name": "Anand",
    "rfid": "3"
  },
  {
    "sr": "3039",
    "name": "Atharv Bhandari",
    "rfid": "4"
  },
  {
    "sr": "3625",
    "name": "Ayansh Nagar",
    "rfid": "5"
  },
  {
    "sr": "3149",
    "name": "Bhavya Singh",
    "rfid": "6"
  },
  {
    "sr": "3123",
    "name": "Daivik Rajput",
    "rfid": "7"
  },
  {
    "sr": "3350",
    "name": "Ditya Chouhan",
    "rfid": "8"
  },
  {
    "sr": "2951",
    "name": "Granth Choudhary",
    "rfid": "9"
  },
  {
    "sr": "3587",
    "name": "Iraa Thakur",
    "rfid": "10"
  },
  {
    "sr": "3525",
    "name": "Izaan Ali Makrani",
    "rfid": "11"
  },
  {
    "sr": "3402",
    "name": "Jinagya Jain",
    "rfid": "12"
  },
  {
    "sr": "3057",
    "name": "Kavya Badodiya",
    "rfid": "13"
  },
  {
    "sr": "3414",
    "name": "Kiara Bahuguna",
    "rfid": "14"
  },
  {
    "sr": "3439",
    "name": "Kush Panwar",
    "rfid": "15"
  },
  {
    "sr": "2889",
    "name": "Lavish Khandelwal",
    "rfid": "16"
  },
  {
    "sr": "3173",
    "name": "Neeom Chouhan",
    "rfid": "17"
  },
  {
    "sr": "3560",
    "name": "Parth Mishra",
    "rfid": "18"
  },
  {
    "sr": "3218",
    "name": "Prince Choudhary",
    "rfid": "19"
  },
  {
    "sr": "3702",
    "name": "Rajhansh Patel",
    "rfid": "20"
  },
  {
    "sr": "2996",
    "name": "Rohit Solanki",
    "rfid": "21"
  },
  {
    "sr": "2982",
    "name": "Rudransh Agrawal",
    "rfid": "22"
  },
  {
    "sr": "3693",
    "name": "Samriddhi Sharma",
    "rfid": "23"
  },
  {
    "sr": "2904",
    "name": "Sanvi Singh",
    "rfid": "24"
  },
  {
    "sr": "3756",
    "name": "Sarthak Jat",
    "rfid": "25"
  },
  {
    "sr": "3166",
    "name": "Semantika Motiramani",
    "rfid": "26"
  },
  {
    "sr": "3678",
    "name": "Shambhavi Kumari",
    "rfid": "27"
  },
  {
    "sr": "2986",
    "name": "Shayaan Khan",
    "rfid": "28"
  },
  {
    "sr": "3458",
    "name": "Shreeansh Bairagi",
    "rfid": "29"
  },
  {
    "sr": "2692",
    "name": "Shreyansh Shrivas",
    "rfid": "30"
  },
  {
    "sr": "2917",
    "name": "Vihan Jaiswal",
    "rfid": "31"
  },
  {
    "sr": "2970",
    "name": "Aditya Singh Parmar",
    "rfid": "32"
  },
  {
    "sr": "3167",
    "name": "Anshuman Rathod",
    "rfid": "33"
  },
  {
    "sr": "2957",
    "name": "Aviral Sharma",
    "rfid": "34"
  },
  {
    "sr": "3155",
    "name": "Divesh Parmar",
    "rfid": "35"
  },
  {
    "sr": "3684",
    "name": "Divy Kadu",
    "rfid": "36"
  },
  {
    "sr": "3579",
    "name": "Divyaraj Singh Panwar",
    "rfid": "37"
  },
  {
    "sr": "3721",
    "name": "Drashti Jain",
    "rfid": "38"
  },
  {
    "sr": "3473",
    "name": "Gajendra Singh Rajput",
    "rfid": "39"
  },
  {
    "sr": "3001",
    "name": "Gourav Raj Singh Chouhan",
    "rfid": "40"
  },
  {
    "sr": "3358",
    "name": "Hardik Maida",
    "rfid": "41"
  },
  {
    "sr": "3027",
    "name": "Harshvardhan Chouhan",
    "rfid": "42"
  },
  {
    "sr": "3415",
    "name": "Krisha Bahuguna",
    "rfid": "43"
  },
  {
    "sr": "3734",
    "name": "Krisha Bhandari",
    "rfid": "44"
  },
  {
    "sr": "2934",
    "name": "Kunj Singh Panwar",
    "rfid": "45"
  },
  {
    "sr": "3040",
    "name": "Lavyansh Bhandari",
    "rfid": "46"
  },
  {
    "sr": "3438",
    "name": "Love Panwar",
    "rfid": "47"
  },
  {
    "sr": "3613",
    "name": "Nikhil Rathore",
    "rfid": "48"
  },
  {
    "sr": "3150",
    "name": "Riyansh Singh",
    "rfid": "49"
  },
  {
    "sr": "3020",
    "name": "Rudra Prakash Parihar",
    "rfid": "50"
  },
  {
    "sr": "3121",
    "name": "Rudra Pratap Singh Sisodiya",
    "rfid": "51"
  },
  {
    "sr": "2966",
    "name": "Saiyas Singh",
    "rfid": "52"
  },
  {
    "sr": "3729",
    "name": "Shivanya Solanki",
    "rfid": "53"
  },
  {
    "sr": "3399",
    "name": "Shreya Mishra",
    "rfid": "54"
  },
  {
    "sr": "3406",
    "name": "Siddhant Raghuvanshi",
    "rfid": "55"
  },
  {
    "sr": "3106",
    "name": "Siyansh Gehlod",
    "rfid": "56"
  },
  {
    "sr": "3655",
    "name": "Suryansh Chauhan",
    "rfid": "57"
  },
  {
    "sr": "3663",
    "name": "Trishabh Nagar",
    "rfid": "58"
  },
  {
    "sr": "3083",
    "name": "Uwani Saratkar",
    "rfid": "59"
  },
  {
    "sr": "2979",
    "name": "Vedanshi Makwana",
    "rfid": "60"
  },
  {
    "sr": "2698",
    "name": "Yug Dangi",
    "rfid": "61"
  },
  {
    "sr": "3496",
    "name": "Zaid Khan",
    "rfid": "62"
  },
  {
    "sr": "3190",
    "name": "Aarohi Mourya",
    "rfid": "63"
  },
  {
    "sr": "3164",
    "name": "Akshat Singh Susner",
    "rfid": "64"
  },
  {
    "sr": "2630",
    "name": "Ansh Choudhary",
    "rfid": "65"
  },
  {
    "sr": "2925",
    "name": "Anvit Mukati",
    "rfid": "66"
  },
  {
    "sr": "2603",
    "name": "Arush Dhiraj",
    "rfid": "67"
  },
  {
    "sr": "2853",
    "name": "Atharv Songara",
    "rfid": "68"
  },
  {
    "sr": "3691",
    "name": "Avik Raj",
    "rfid": "69"
  },
  {
    "sr": "2798",
    "name": "Bhoomika Patel",
    "rfid": "70"
  },
  {
    "sr": "3491",
    "name": "Divyansh Sisodiya",
    "rfid": "71"
  },
  {
    "sr": "2794",
    "name": "Divyant Raghuwanshi",
    "rfid": "72"
  },
  {
    "sr": "2914",
    "name": "Harshveer Singh",
    "rfid": "73"
  },
  {
    "sr": "2710",
    "name": "Jivesh Yadav",
    "rfid": "74"
  },
  {
    "sr": "2940",
    "name": "Kalp Kothari",
    "rfid": "75"
  },
  {
    "sr": "3561",
    "name": "Krishna Chouhan",
    "rfid": "76"
  },
  {
    "sr": "3494",
    "name": "Lakshit Chaturvedi",
    "rfid": "77"
  },
  {
    "sr": "3466",
    "name": "Mayank Singh",
    "rfid": "78"
  },
  {
    "sr": "3510",
    "name": "Mohd. Jafar Khan",
    "rfid": "79"
  },
  {
    "sr": "3046",
    "name": "Nitya Choudhary",
    "rfid": "80"
  },
  {
    "sr": "3420",
    "name": "Padmnabh Singh Sisodiya",
    "rfid": "81"
  },
  {
    "sr": "2711",
    "name": "Parth Singh",
    "rfid": "82"
  },
  {
    "sr": "3421",
    "name": "Priyadarshiniraj Sisodiya",
    "rfid": "83"
  },
  {
    "sr": "3548",
    "name": "Raghvendra Yadav",
    "rfid": "84"
  },
  {
    "sr": "3748",
    "name": "Samar Prajapati",
    "rfid": "85"
  },
  {
    "sr": "2654",
    "name": "Shivay Kourav",
    "rfid": "86"
  },
  {
    "sr": "2762",
    "name": "Shourya Goswami",
    "rfid": "87"
  },
  {
    "sr": "3696",
    "name": "Shreyansh Kumar Mishra",
    "rfid": "88"
  },
  {
    "sr": "2912",
    "name": "Siddhi Solanki",
    "rfid": "89"
  },
  {
    "sr": "3732",
    "name": "Tanisha Maurya",
    "rfid": "90"
  },
  {
    "sr": "3567",
    "name": "Veera Solanki",
    "rfid": "91"
  },
  {
    "sr": "3021",
    "name": "Vivan Yadav",
    "rfid": "92"
  },
  {
    "sr": "3447",
    "name": "Aaryaman Patel",
    "rfid": "93"
  },
  {
    "sr": "3559",
    "name": "Anirudhra Raghuvanshi",
    "rfid": "94"
  },
  {
    "sr": "3225",
    "name": "Anmol Nagar",
    "rfid": "95"
  },
  {
    "sr": "3119",
    "name": "Anvi Nagar",
    "rfid": "96"
  },
  {
    "sr": "3487",
    "name": "Avni Sharma",
    "rfid": "97"
  },
  {
    "sr": "2699",
    "name": "Dhruv Dangi",
    "rfid": "98"
  },
  {
    "sr": "2948",
    "name": "Jinisha Solanki",
    "rfid": "99"
  },
  {
    "sr": "2941",
    "name": "Krishika Jaiswal",
    "rfid": "100"
  },
  {
    "sr": "2716",
    "name": "Mahatv Pratap Singh Chouhan",
    "rfid": "101"
  },
  {
    "sr": "2926",
    "name": "Nairiti Malviya",
    "rfid": "102"
  },
  {
    "sr": "3708",
    "name": "Neevishka Solanki",
    "rfid": "103"
  },
  {
    "sr": "3442",
    "name": "Nidhan Bairagi",
    "rfid": "104"
  },
  {
    "sr": "3412",
    "name": "Nityanta Solanki",
    "rfid": "105"
  },
  {
    "sr": "3130",
    "name": "Priyal Jirati",
    "rfid": "106"
  },
  {
    "sr": "3620",
    "name": "Priyansh Dangore",
    "rfid": "107"
  },
  {
    "sr": "3536",
    "name": "Raj Malivya",
    "rfid": "108"
  },
  {
    "sr": "3072",
    "name": "Rakshit Thakur",
    "rfid": "109"
  },
  {
    "sr": "2836",
    "name": "Rohnit Rai",
    "rfid": "110"
  },
  {
    "sr": "2704",
    "name": "Rudra Bariya",
    "rfid": "111"
  },
  {
    "sr": "3705",
    "name": "Rudraksh Tiwari",
    "rfid": "112"
  },
  {
    "sr": "2789",
    "name": "Rudransh Raghuwanshi",
    "rfid": "113"
  },
  {
    "sr": "3369",
    "name": "Samaksh Somani",
    "rfid": "114"
  },
  {
    "sr": "3659",
    "name": "Sanskriti Dayal",
    "rfid": "115"
  },
  {
    "sr": "2591",
    "name": "Shreedhi Dhamani",
    "rfid": "116"
  },
  {
    "sr": "2784",
    "name": "Siddharth Chouhan",
    "rfid": "117"
  },
  {
    "sr": "2919",
    "name": "Tanmay Yadav",
    "rfid": "118"
  },
  {
    "sr": "2893",
    "name": "Vishvaditya Chouhan",
    "rfid": "119"
  },
  {
    "sr": "3148",
    "name": "Vivaan Soni",
    "rfid": "120"
  },
  {
    "sr": "3112",
    "name": "Yashveer Yadav",
    "rfid": "121"
  },
  {
    "sr": "3547",
    "name": "Aarav Chouhan",
    "rfid": "122"
  },
  {
    "sr": "2632",
    "name": "Akshat Jirati",
    "rfid": "123"
  },
  {
    "sr": "3107",
    "name": "Amayra Jadhav",
    "rfid": "124"
  },
  {
    "sr": "3366",
    "name": "Anaya Vyas",
    "rfid": "125"
  },
  {
    "sr": "3565",
    "name": "Anshuman Palta Singh",
    "rfid": "126"
  },
  {
    "sr": "2954",
    "name": "Avnika Choudhary",
    "rfid": "127"
  },
  {
    "sr": "2907",
    "name": "Devyani Chouhan",
    "rfid": "128"
  },
  {
    "sr": "2876",
    "name": "Dhruvin Joshi",
    "rfid": "129"
  },
  {
    "sr": "2887",
    "name": "Disha Jirati",
    "rfid": "130"
  },
  {
    "sr": "2935",
    "name": "Divyansh Singh Panwar",
    "rfid": "131"
  },
  {
    "sr": "3361",
    "name": "Granth Choudhary",
    "rfid": "132"
  },
  {
    "sr": "3146",
    "name": "Inaisha Soni",
    "rfid": "133"
  },
  {
    "sr": "2769",
    "name": "Jignesh Raghuvanshi",
    "rfid": "134"
  },
  {
    "sr": "3628",
    "name": "Kartik Rajput",
    "rfid": "135"
  },
  {
    "sr": "2942",
    "name": "Manasvi Barnashiya",
    "rfid": "136"
  },
  {
    "sr": "3071",
    "name": "Mitanshu Yadav",
    "rfid": "137"
  },
  {
    "sr": "3074",
    "name": "Mohammad Ali Khan",
    "rfid": "138"
  },
  {
    "sr": "2974",
    "name": "Prathviraj Khare",
    "rfid": "139"
  },
  {
    "sr": "2652",
    "name": "Preet Sisodiya",
    "rfid": "140"
  },
  {
    "sr": "2671",
    "name": "Sadiya Khan",
    "rfid": "141"
  },
  {
    "sr": "2839",
    "name": "Samarth Jatwa",
    "rfid": "142"
  },
  {
    "sr": "2728",
    "name": "Sarthak Joshi",
    "rfid": "143"
  },
  {
    "sr": "2943",
    "name": "Tanu Pandit",
    "rfid": "144"
  },
  {
    "sr": "3662",
    "name": "Vedansh Makwana",
    "rfid": "145"
  },
  {
    "sr": "3517",
    "name": "Zaid Khan",
    "rfid": "146"
  },
  {
    "sr": "2913",
    "name": "Zakariya Mehar",
    "rfid": "147"
  },
  {
    "sr": "2742",
    "name": "Aarvi Soni",
    "rfid": "148"
  },
  {
    "sr": "2905",
    "name": "Alok Kumar Gautam",
    "rfid": "149"
  },
  {
    "sr": "2815",
    "name": "Anaya Vaishnav",
    "rfid": "150"
  },
  {
    "sr": "3564",
    "name": "Aradhya Palta Singh",
    "rfid": "151"
  },
  {
    "sr": "3006",
    "name": "Areesha Khan",
    "rfid": "152"
  },
  {
    "sr": "2975",
    "name": "Atharv Yadav",
    "rfid": "153"
  },
  {
    "sr": "3193",
    "name": "Bhavil Sahu",
    "rfid": "154"
  },
  {
    "sr": "2746",
    "name": "Chitransh Kulariya",
    "rfid": "155"
  },
  {
    "sr": "3726",
    "name": "Darsh Soni",
    "rfid": "156"
  },
  {
    "sr": "3540",
    "name": "Darvesh Singh",
    "rfid": "157"
  },
  {
    "sr": "2714",
    "name": "Dharv Bhosle",
    "rfid": "158"
  },
  {
    "sr": "2633",
    "name": "Havisha Mishra",
    "rfid": "159"
  },
  {
    "sr": "2589",
    "name": "Jenil Choudhary",
    "rfid": "160"
  },
  {
    "sr": "2846",
    "name": "Jignesh Rathore",
    "rfid": "161"
  },
  {
    "sr": "2551",
    "name": "Khushal Yadav",
    "rfid": "162"
  },
  {
    "sr": "3127",
    "name": "Kiyansh Kaushal",
    "rfid": "163"
  },
  {
    "sr": "3644",
    "name": "Kunal Singh Rajput",
    "rfid": "164"
  },
  {
    "sr": "2650",
    "name": "Lavishka Kamble",
    "rfid": "165"
  },
  {
    "sr": "2867",
    "name": "Mahima Shree",
    "rfid": "166"
  },
  {
    "sr": "2557",
    "name": "Mayank Choudhary",
    "rfid": "167"
  },
  {
    "sr": "3037",
    "name": "Mihika Patidar",
    "rfid": "168"
  },
  {
    "sr": "2586",
    "name": "Misha Dhamani",
    "rfid": "169"
  },
  {
    "sr": "2981",
    "name": "Mitanshi Agrawal",
    "rfid": "170"
  },
  {
    "sr": "3524",
    "name": "Mohd. Umair Makrani",
    "rfid": "171"
  },
  {
    "sr": "3455",
    "name": "Noman Khan",
    "rfid": "172"
  },
  {
    "sr": "3411",
    "name": "Raghav Singh Surywanshi",
    "rfid": "173"
  },
  {
    "sr": "3572",
    "name": "Rajeshwari Yadav",
    "rfid": "174"
  },
  {
    "sr": "3212",
    "name": "Ranaditya Chhadodi",
    "rfid": "175"
  },
  {
    "sr": "2783",
    "name": "Rohit Bariya",
    "rfid": "176"
  },
  {
    "sr": "3194",
    "name": "Ruhi Raghuwanshi",
    "rfid": "177"
  },
  {
    "sr": "3220",
    "name": "Ruhika Makwana",
    "rfid": "178"
  },
  {
    "sr": "2686",
    "name": "Sanaya Paliwal",
    "rfid": "179"
  },
  {
    "sr": "2579",
    "name": "Shivay Chaturvedi",
    "rfid": "180"
  },
  {
    "sr": "2778",
    "name": "Shivay Pal",
    "rfid": "181"
  },
  {
    "sr": "3654",
    "name": "Shourya Chauhan",
    "rfid": "182"
  },
  {
    "sr": "3101",
    "name": "Stuti Gautam",
    "rfid": "183"
  },
  {
    "sr": "3174",
    "name": "Suvrana Panday",
    "rfid": "184"
  },
  {
    "sr": "3544",
    "name": "Vidhan Makwana",
    "rfid": "185"
  },
  {
    "sr": "3207",
    "name": "Vyom Ujjainiya",
    "rfid": "186"
  },
  {
    "sr": "3445",
    "name": "Yuvan Mourya",
    "rfid": "187"
  },
  {
    "sr": "3709",
    "name": "Yuvika Singh",
    "rfid": "188"
  },
  {
    "sr": "3443",
    "name": "Aayesha Sheikh",
    "rfid": "189"
  },
  {
    "sr": "3751",
    "name": "Aayna Gurjar",
    "rfid": "190"
  },
  {
    "sr": "2659",
    "name": "Anaya Choudhary",
    "rfid": "191"
  },
  {
    "sr": "3595",
    "name": "Anirudh Garain",
    "rfid": "192"
  },
  {
    "sr": "3041",
    "name": "Anirudh Meena",
    "rfid": "193"
  },
  {
    "sr": "2690",
    "name": "Ariha Jain",
    "rfid": "194"
  },
  {
    "sr": "2593",
    "name": "Atigya Choudhary",
    "rfid": "195"
  },
  {
    "sr": "2657",
    "name": "Aviraj Chaturvedi",
    "rfid": "196"
  },
  {
    "sr": "2911",
    "name": "Bhavyansh Sharma",
    "rfid": "197"
  },
  {
    "sr": "2588",
    "name": "Bhuvnesh Choudhary",
    "rfid": "198"
  },
  {
    "sr": "3752",
    "name": "Daksh Gautam",
    "rfid": "199"
  },
  {
    "sr": "3593",
    "name": "Devyani Ray",
    "rfid": "200"
  },
  {
    "sr": "3588",
    "name": "Divyanshi Sharma",
    "rfid": "201"
  },
  {
    "sr": "2667",
    "name": "Harsh Kumar Singh",
    "rfid": "202"
  },
  {
    "sr": "2883",
    "name": "Himanshi Solanki",
    "rfid": "203"
  },
  {
    "sr": "3356",
    "name": "Ishaan Vijayvargiya",
    "rfid": "204"
  },
  {
    "sr": "3357",
    "name": "Ivan Vijayvargiya",
    "rfid": "205"
  },
  {
    "sr": "3341",
    "name": "Khanika Sharma",
    "rfid": "206"
  },
  {
    "sr": "2768",
    "name": "Khyati Agrawal",
    "rfid": "207"
  },
  {
    "sr": "3665",
    "name": "Kulshresth Mandloi",
    "rfid": "208"
  },
  {
    "sr": "3058",
    "name": "Madhav Yadav",
    "rfid": "209"
  },
  {
    "sr": "3452",
    "name": "Manya Sonone",
    "rfid": "210"
  },
  {
    "sr": "3175",
    "name": "Masira Fatima",
    "rfid": "211"
  },
  {
    "sr": "2683",
    "name": "Mihika Chouhan",
    "rfid": "212"
  },
  {
    "sr": "2638",
    "name": "Moksh Sharma",
    "rfid": "213"
  },
  {
    "sr": "2525",
    "name": "Naman Patidar",
    "rfid": "214"
  },
  {
    "sr": "3160",
    "name": "Nitara Panwar",
    "rfid": "215"
  },
  {
    "sr": "3594",
    "name": "Pihu Manik Garain",
    "rfid": "216"
  },
  {
    "sr": "2600",
    "name": "Prisha Patidar",
    "rfid": "217"
  },
  {
    "sr": "3462",
    "name": "Priyal Parmar",
    "rfid": "218"
  },
  {
    "sr": "3011",
    "name": "Rajveer Jat",
    "rfid": "219"
  },
  {
    "sr": "3228",
    "name": "Ridham Mourya",
    "rfid": "220"
  },
  {
    "sr": "3200",
    "name": "Riyansh Nagar",
    "rfid": "221"
  },
  {
    "sr": "2755",
    "name": "Sanskrati Haldkar",
    "rfid": "222"
  },
  {
    "sr": "3336",
    "name": "Shivaay Songare",
    "rfid": "223"
  },
  {
    "sr": "2829",
    "name": "Siya Jirati",
    "rfid": "224"
  },
  {
    "sr": "2681",
    "name": "Suryansh Singh Parihar",
    "rfid": "225"
  },
  {
    "sr": "2928",
    "name": "Vedant Ranjan",
    "rfid": "226"
  },
  {
    "sr": "3612",
    "name": "Abhimanyu Singh Patel",
    "rfid": "227"
  },
  {
    "sr": "3035",
    "name": "Abhiyansh Jat",
    "rfid": "228"
  },
  {
    "sr": "3553",
    "name": "Amol Thakur",
    "rfid": "229"
  },
  {
    "sr": "3501",
    "name": "Anvesh Joshi",
    "rfid": "230"
  },
  {
    "sr": "2707",
    "name": "Aryan Thakur",
    "rfid": "231"
  },
  {
    "sr": "2767",
    "name": "Avik Rathore",
    "rfid": "232"
  },
  {
    "sr": "2995",
    "name": "Daksh Parmar",
    "rfid": "233"
  },
  {
    "sr": "3408",
    "name": "Devansh Raghuvanshi",
    "rfid": "234"
  },
  {
    "sr": "3407",
    "name": "Garima Raghuvanshi",
    "rfid": "235"
  },
  {
    "sr": "3761",
    "name": "Harjas Kaur",
    "rfid": "236"
  },
  {
    "sr": "3642",
    "name": "Harshalika Sisodiya",
    "rfid": "237"
  },
  {
    "sr": "3550",
    "name": "Hiya Jain",
    "rfid": "238"
  },
  {
    "sr": "2653",
    "name": "Hridhyansh Laud",
    "rfid": "239"
  },
  {
    "sr": "2833",
    "name": "Jayvardhan Singh Thakur",
    "rfid": "240"
  },
  {
    "sr": "3391",
    "name": "Kartavya Raj Singh Bhati",
    "rfid": "241"
  },
  {
    "sr": "3485",
    "name": "Kartik Kushwah",
    "rfid": "242"
  },
  {
    "sr": "2782",
    "name": "Khushi Bagwan",
    "rfid": "243"
  },
  {
    "sr": "3224",
    "name": "Kunal Singh Chouhan",
    "rfid": "244"
  },
  {
    "sr": "2584",
    "name": "Prayas Yadav",
    "rfid": "245"
  },
  {
    "sr": "3427",
    "name": "Rehan Kureshi",
    "rfid": "246"
  },
  {
    "sr": "2660",
    "name": "Rishabh Yadav",
    "rfid": "247"
  },
  {
    "sr": "2850",
    "name": "Rudra Bairagi",
    "rfid": "248"
  },
  {
    "sr": "2859",
    "name": "Rudra Pratap Singh",
    "rfid": "249"
  },
  {
    "sr": "3526",
    "name": "Sarthak Shrivastava",
    "rfid": "250"
  },
  {
    "sr": "3054",
    "name": "Shreyansh Mukati",
    "rfid": "251"
  },
  {
    "sr": "2825",
    "name": "Siddharth Solanki",
    "rfid": "252"
  },
  {
    "sr": "2754",
    "name": "Sindhu Gehlot",
    "rfid": "253"
  },
  {
    "sr": "3600",
    "name": "Somiya Upadhyay",
    "rfid": "254"
  },
  {
    "sr": "3633",
    "name": "Umer Raza Khan",
    "rfid": "255"
  },
  {
    "sr": "2732",
    "name": "Unnati Sejgaya",
    "rfid": "256"
  },
  {
    "sr": "2780",
    "name": "Utkarsh Jatwa",
    "rfid": "257"
  },
  {
    "sr": "3651",
    "name": "Vaidik Tanwar",
    "rfid": "258"
  },
  {
    "sr": "3209",
    "name": "Vanshraj Sankla",
    "rfid": "259"
  },
  {
    "sr": "2580",
    "name": "Vedahi Badodiya",
    "rfid": "260"
  },
  {
    "sr": "2504",
    "name": "Veer Jirati",
    "rfid": "261"
  },
  {
    "sr": "2583",
    "name": "Yashraj Kamdar",
    "rfid": "262"
  },
  {
    "sr": "3343",
    "name": "Yug Pratap Singh Chouhan",
    "rfid": "263"
  },
  {
    "sr": "3514",
    "name": "Aaman Khan",
    "rfid": "264"
  },
  {
    "sr": "2799",
    "name": "Aditi Patel",
    "rfid": "265"
  },
  {
    "sr": "2625",
    "name": "Ajuni Kaur Chhabra",
    "rfid": "266"
  },
  {
    "sr": "3499",
    "name": "Amay Joshi",
    "rfid": "267"
  },
  {
    "sr": "2628",
    "name": "Anay Kumrawat",
    "rfid": "268"
  },
  {
    "sr": "2415",
    "name": "Anika Gayakwad",
    "rfid": "269"
  },
  {
    "sr": "2693",
    "name": "Anirudh Rathore",
    "rfid": "270"
  },
  {
    "sr": "3426",
    "name": "Bhavika Nagar",
    "rfid": "271"
  },
  {
    "sr": "3669",
    "name": "Chahat Pal",
    "rfid": "272"
  },
  {
    "sr": "3492",
    "name": "Dakshraj Sisodiya",
    "rfid": "273"
  },
  {
    "sr": "3023",
    "name": "Divyansh Raghuvanshi",
    "rfid": "274"
  },
  {
    "sr": "3576",
    "name": "Himanshu Raghuvanshi",
    "rfid": "275"
  },
  {
    "sr": "3590",
    "name": "Jayant Sharma",
    "rfid": "276"
  },
  {
    "sr": "2969",
    "name": "Khushi Parmar",
    "rfid": "277"
  },
  {
    "sr": "2443",
    "name": "Krishna Rathore",
    "rfid": "278"
  },
  {
    "sr": "3213",
    "name": "Manav Chouhan",
    "rfid": "279"
  },
  {
    "sr": "2920",
    "name": "Mishika Panchal",
    "rfid": "280"
  },
  {
    "sr": "2661",
    "name": "Parth Singh",
    "rfid": "281"
  },
  {
    "sr": "3370",
    "name": "Raj Verma",
    "rfid": "282"
  },
  {
    "sr": "2548",
    "name": "Reyansh Parmar",
    "rfid": "283"
  },
  {
    "sr": "3577",
    "name": "Rihanshu Raghuvanshi",
    "rfid": "284"
  },
  {
    "sr": "2831",
    "name": "Ritesh Jatwa",
    "rfid": "285"
  },
  {
    "sr": "2994",
    "name": "Rudra Badwaya",
    "rfid": "286"
  },
  {
    "sr": "3584",
    "name": "Rudra Raghuvanshi",
    "rfid": "287"
  },
  {
    "sr": "2592",
    "name": "Rudransh Joshi",
    "rfid": "288"
  },
  {
    "sr": "2967",
    "name": "Saisa Singh",
    "rfid": "289"
  },
  {
    "sr": "2879",
    "name": "Samrat Solanki",
    "rfid": "290"
  },
  {
    "sr": "3727",
    "name": "Sanavi Rajput",
    "rfid": "291"
  },
  {
    "sr": "3090",
    "name": "Sanidhya Patel",
    "rfid": "292"
  },
  {
    "sr": "2629",
    "name": "Tejasveer Singh Chouhan",
    "rfid": "293"
  },
  {
    "sr": "3645",
    "name": "Tejaswani Singh Rajput",
    "rfid": "294"
  },
  {
    "sr": "3120",
    "name": "Vadehi Thakur",
    "rfid": "295"
  },
  {
    "sr": "2800",
    "name": "Vanshraj Parihar",
    "rfid": "296"
  },
  {
    "sr": "3630",
    "name": "Vinayak Rathore",
    "rfid": "297"
  },
  {
    "sr": "2655",
    "name": "Vrandan Singh Chauhan",
    "rfid": "298"
  },
  {
    "sr": "3720",
    "name": "Vrati Jain",
    "rfid": "299"
  },
  {
    "sr": "3428",
    "name": "Zeeshan Kureshi",
    "rfid": "300"
  },
  {
    "sr": "3528",
    "name": "Abhas Singh",
    "rfid": "301"
  },
  {
    "sr": "3372",
    "name": "Amendra Singh",
    "rfid": "302"
  },
  {
    "sr": "2852",
    "name": "Anish Songara",
    "rfid": "303"
  },
  {
    "sr": "3742",
    "name": "Anuj",
    "rfid": "304"
  },
  {
    "sr": "2577",
    "name": "Atharv Jaiswal",
    "rfid": "305"
  },
  {
    "sr": "2335",
    "name": "Devika Gehlod",
    "rfid": "306"
  },
  {
    "sr": "2868",
    "name": "Durgashree Gehlod",
    "rfid": "307"
  },
  {
    "sr": "2369",
    "name": "Geet Patidar",
    "rfid": "308"
  },
  {
    "sr": "2426",
    "name": "Gouransh Kumrawat",
    "rfid": "309"
  },
  {
    "sr": "2882",
    "name": "Harshita Chouhan",
    "rfid": "310"
  },
  {
    "sr": "3219",
    "name": "Kartavya Khanna",
    "rfid": "311"
  },
  {
    "sr": "2373",
    "name": "Keshvi Choudhary",
    "rfid": "312"
  },
  {
    "sr": "2744",
    "name": "Lakshita Gehlot",
    "rfid": "313"
  },
  {
    "sr": "3354",
    "name": "Lakshy Mishra",
    "rfid": "314"
  },
  {
    "sr": "3201",
    "name": "Moinuddin Khan",
    "rfid": "315"
  },
  {
    "sr": "2691",
    "name": "Nakshraj Chouhan",
    "rfid": "316"
  },
  {
    "sr": "3716",
    "name": "Nakul Chouhan",
    "rfid": "317"
  },
  {
    "sr": "2361",
    "name": "Nilanshi Upadhyay",
    "rfid": "318"
  },
  {
    "sr": "3454",
    "name": "Prajwal Thakur",
    "rfid": "319"
  },
  {
    "sr": "3359",
    "name": "Preyansh  Mahajan",
    "rfid": "320"
  },
  {
    "sr": "2341",
    "name": "Samriddhi Maheshwari",
    "rfid": "321"
  },
  {
    "sr": "3725",
    "name": "Sanay Soni",
    "rfid": "322"
  },
  {
    "sr": "2639",
    "name": "Shivi Mishra",
    "rfid": "323"
  },
  {
    "sr": "2530",
    "name": "Shruti Rana",
    "rfid": "324"
  },
  {
    "sr": "2863",
    "name": "Vansh Panwar",
    "rfid": "325"
  },
  {
    "sr": "3537",
    "name": "Vinee Khatri",
    "rfid": "326"
  },
  {
    "sr": "2658",
    "name": "Vivaan Makwana",
    "rfid": "327"
  },
  {
    "sr": "3226",
    "name": "Yashasvi Bhandari",
    "rfid": "328"
  },
  {
    "sr": "3396",
    "name": "Yuvraj Varma",
    "rfid": "329"
  },
  {
    "sr": "3758",
    "name": "Aarya Rai",
    "rfid": "330"
  },
  {
    "sr": "3754",
    "name": "Anmol Septa",
    "rfid": "331"
  },
  {
    "sr": "2338",
    "name": "Anshuman Choudhary",
    "rfid": "332"
  },
  {
    "sr": "3685",
    "name": "Avanish Mukati",
    "rfid": "333"
  },
  {
    "sr": "3699",
    "name": "Chirayu Jain",
    "rfid": "334"
  },
  {
    "sr": "2438",
    "name": "Devansh Singh",
    "rfid": "335"
  },
  {
    "sr": "3116",
    "name": "Divyansh Rathore",
    "rfid": "336"
  },
  {
    "sr": "3701",
    "name": "Gouransh Jat",
    "rfid": "337"
  },
  {
    "sr": "3474",
    "name": "Hamza Altaf",
    "rfid": "338"
  },
  {
    "sr": "3468",
    "name": "Janak Varma",
    "rfid": "339"
  },
  {
    "sr": "2870",
    "name": "Jayant Parmar",
    "rfid": "340"
  },
  {
    "sr": "2802",
    "name": "Lakshya Raj Singh Goud",
    "rfid": "341"
  },
  {
    "sr": "3437",
    "name": "Manasvi Goyal",
    "rfid": "342"
  },
  {
    "sr": "2529",
    "name": "Manmeet Saini",
    "rfid": "343"
  },
  {
    "sr": "3059",
    "name": "Mayank Yadav",
    "rfid": "344"
  },
  {
    "sr": "3394",
    "name": "Naman Yadav",
    "rfid": "345"
  },
  {
    "sr": "3139",
    "name": "Neha Kumari",
    "rfid": "346"
  },
  {
    "sr": "3165",
    "name": "Prakriti Susner",
    "rfid": "347"
  },
  {
    "sr": "2364",
    "name": "Samriddhi Thakur",
    "rfid": "348"
  },
  {
    "sr": "3393",
    "name": "Shobhit Mourya",
    "rfid": "349"
  },
  {
    "sr": "2380",
    "name": "Somiya Choudhary",
    "rfid": "350"
  },
  {
    "sr": "2382",
    "name": "Urvi Sharma",
    "rfid": "351"
  },
  {
    "sr": "3648",
    "name": "Vansal Mourya",
    "rfid": "352"
  },
  {
    "sr": "2645",
    "name": "Vanshraj Dawar",
    "rfid": "353"
  },
  {
    "sr": "3529",
    "name": "Vedant Kumar Gupta",
    "rfid": "354"
  },
  {
    "sr": "3044",
    "name": "Viraj Bamotriya",
    "rfid": "355"
  },
  {
    "sr": "2821",
    "name": "Virat Doad",
    "rfid": "356"
  },
  {
    "sr": "3578",
    "name": "Vishavraj Singh Panwar",
    "rfid": "357"
  },
  {
    "sr": "2270",
    "name": "Adira Yadav",
    "rfid": "358"
  },
  {
    "sr": "2749",
    "name": "Anubhav Pandey",
    "rfid": "359"
  },
  {
    "sr": "2457",
    "name": "Chetanya Jadhav",
    "rfid": "360"
  },
  {
    "sr": "2965",
    "name": "Devanshi Bhume",
    "rfid": "361"
  },
  {
    "sr": "3735",
    "name": "Devshri Gangarekar",
    "rfid": "362"
  },
  {
    "sr": "2752",
    "name": "Divyank Bhabar",
    "rfid": "363"
  },
  {
    "sr": "2563",
    "name": "Gouravraj Choudhary",
    "rfid": "364"
  },
  {
    "sr": "2414",
    "name": "Hanshika Yadav",
    "rfid": "365"
  },
  {
    "sr": "2718",
    "name": "Jagrati Maida",
    "rfid": "366"
  },
  {
    "sr": "3611",
    "name": "Kartik Prajapat",
    "rfid": "367"
  },
  {
    "sr": "3657",
    "name": "Kartik Thakur",
    "rfid": "368"
  },
  {
    "sr": "3210",
    "name": "Kavish Mukati",
    "rfid": "369"
  },
  {
    "sr": "2407",
    "name": "Lavanya Jirati",
    "rfid": "370"
  },
  {
    "sr": "3706",
    "name": "Lavya Pathe",
    "rfid": "371"
  },
  {
    "sr": "2777",
    "name": "Manvendra Bhinde",
    "rfid": "372"
  },
  {
    "sr": "2471",
    "name": "Mohammad Faiz Khan",
    "rfid": "373"
  },
  {
    "sr": "3635",
    "name": "Nikunj Panwar",
    "rfid": "374"
  },
  {
    "sr": "2680",
    "name": "Nimisha Kewat",
    "rfid": "375"
  },
  {
    "sr": "2371",
    "name": "Rachit Chourse",
    "rfid": "376"
  },
  {
    "sr": "3118",
    "name": "Rajvansh Sisodiya",
    "rfid": "377"
  },
  {
    "sr": "2425",
    "name": "Swastik Choudhary",
    "rfid": "378"
  },
  {
    "sr": "2571",
    "name": "Tanveer Jamliya",
    "rfid": "379"
  },
  {
    "sr": "3730",
    "name": "Vandana Solanki",
    "rfid": "380"
  },
  {
    "sr": "2822",
    "name": "Vanshraj Doad",
    "rfid": "381"
  },
  {
    "sr": "2862",
    "name": "Vardan Jat",
    "rfid": "382"
  },
  {
    "sr": "2411",
    "name": "Viraj Parmar",
    "rfid": "383"
  },
  {
    "sr": "2463",
    "name": "Viransh Badodiya",
    "rfid": "384"
  },
  {
    "sr": "3154",
    "name": "Yogeshwari Patel",
    "rfid": "385"
  },
  {
    "sr": "3368",
    "name": "Aarohi Somani",
    "rfid": "386"
  },
  {
    "sr": "3475",
    "name": "Aayat Parveen",
    "rfid": "387"
  },
  {
    "sr": "2642",
    "name": "Abhay Singh Sengar",
    "rfid": "388"
  },
  {
    "sr": "2729",
    "name": "Anshuman Choudhary",
    "rfid": "389"
  },
  {
    "sr": "2538",
    "name": "Anvi Mandloi",
    "rfid": "390"
  },
  {
    "sr": "3541",
    "name": "Divya Jain",
    "rfid": "391"
  },
  {
    "sr": "2420",
    "name": "Divyansh Choudhary",
    "rfid": "392"
  },
  {
    "sr": "3542",
    "name": "Drashti Jain",
    "rfid": "393"
  },
  {
    "sr": "3388",
    "name": "Garv Parihar",
    "rfid": "394"
  },
  {
    "sr": "2243",
    "name": "Hansika Verma",
    "rfid": "395"
  },
  {
    "sr": "2848",
    "name": "Jigar Rathore",
    "rfid": "396"
  },
  {
    "sr": "2245",
    "name": "Kavya Raghuvanshi",
    "rfid": "397"
  },
  {
    "sr": "2585",
    "name": "Lakshya Raj Singh Chouhan",
    "rfid": "398"
  },
  {
    "sr": "3169",
    "name": "Lokya Chourasiya",
    "rfid": "399"
  },
  {
    "sr": "3484",
    "name": "Ojasva Pathak",
    "rfid": "400"
  },
  {
    "sr": "2880",
    "name": "Prince Solanki",
    "rfid": "401"
  },
  {
    "sr": "2950",
    "name": "Prithviraj Singh Rathore",
    "rfid": "402"
  },
  {
    "sr": "3022",
    "name": "Priyanshi Mishra",
    "rfid": "403"
  },
  {
    "sr": "2196",
    "name": "Rajveer Raghuvanshi",
    "rfid": "404"
  },
  {
    "sr": "2440",
    "name": "Rajveer Singh Chouhan",
    "rfid": "405"
  },
  {
    "sr": "2856",
    "name": "Rajveer Songara",
    "rfid": "406"
  },
  {
    "sr": "3506",
    "name": "Ranveer Patidar",
    "rfid": "407"
  },
  {
    "sr": "3683",
    "name": "Rhythm Kadu",
    "rfid": "408"
  },
  {
    "sr": "2241",
    "name": "Rishit Patidar",
    "rfid": "409"
  },
  {
    "sr": "2293",
    "name": "Ruhika Choudhary",
    "rfid": "410"
  },
  {
    "sr": "2611",
    "name": "Sakshi Jat",
    "rfid": "411"
  },
  {
    "sr": "2636",
    "name": "Samar Pratap Singh Solanki",
    "rfid": "412"
  },
  {
    "sr": "2526",
    "name": "Sanaya Rathore",
    "rfid": "413"
  },
  {
    "sr": "2598",
    "name": "Shivika Singh",
    "rfid": "414"
  },
  {
    "sr": "2107",
    "name": "Sunny Choudhary",
    "rfid": "415"
  },
  {
    "sr": "2992",
    "name": "Vansh Verma",
    "rfid": "416"
  },
  {
    "sr": "3140",
    "name": "Yuvraj Raghuvanshi",
    "rfid": "417"
  },
  {
    "sr": "2539",
    "name": "Aadesh Salunke",
    "rfid": "418"
  },
  {
    "sr": "3539",
    "name": "Aarvi Kaur",
    "rfid": "419"
  },
  {
    "sr": "2143",
    "name": "Abdul Rehman",
    "rfid": "420"
  },
  {
    "sr": "3002",
    "name": "Abhika Vyas",
    "rfid": "421"
  },
  {
    "sr": "3403",
    "name": "Abhimanyu Suner",
    "rfid": "422"
  },
  {
    "sr": "3397",
    "name": "Akshay Verma",
    "rfid": "423"
  },
  {
    "sr": "2906",
    "name": "Anamika Gautam",
    "rfid": "424"
  },
  {
    "sr": "3134",
    "name": "Aniket Choudhary",
    "rfid": "425"
  },
  {
    "sr": "2737",
    "name": "Ansh Pathak",
    "rfid": "426"
  },
  {
    "sr": "2342",
    "name": "Anushka",
    "rfid": "427"
  },
  {
    "sr": "2830",
    "name": "Anvesha Solanki",
    "rfid": "428"
  },
  {
    "sr": "3053",
    "name": "Aradhana Raghuwanshi",
    "rfid": "429"
  },
  {
    "sr": "2365",
    "name": "Ayansh Jain",
    "rfid": "430"
  },
  {
    "sr": "3589",
    "name": "Darshan Sharma",
    "rfid": "431"
  },
  {
    "sr": "2148",
    "name": "Dhakad Prince Bhandari",
    "rfid": "432"
  },
  {
    "sr": "3018",
    "name": "Govind Thakur",
    "rfid": "433"
  },
  {
    "sr": "3472",
    "name": "Karan Singh Rajput",
    "rfid": "434"
  },
  {
    "sr": "2599",
    "name": "Kunj Soni",
    "rfid": "435"
  },
  {
    "sr": "3622",
    "name": "Mohd. Zishan Shah",
    "rfid": "436"
  },
  {
    "sr": "3723",
    "name": "Parth Solanki",
    "rfid": "437"
  },
  {
    "sr": "2608",
    "name": "Prachi Patel",
    "rfid": "438"
  },
  {
    "sr": "2818",
    "name": "Prashwet Awasthi",
    "rfid": "439"
  },
  {
    "sr": "2635",
    "name": "Prithviraj Solanki",
    "rfid": "440"
  },
  {
    "sr": "2715",
    "name": "Raghavendra Sharma",
    "rfid": "441"
  },
  {
    "sr": "2452",
    "name": "Rajvi Soni",
    "rfid": "442"
  },
  {
    "sr": "3598",
    "name": "Ranveer Singh Jawara",
    "rfid": "443"
  },
  {
    "sr": "3449",
    "name": "Rishu Kumar",
    "rfid": "444"
  },
  {
    "sr": "3199",
    "name": "Riyarth Singh Kushwah",
    "rfid": "445"
  },
  {
    "sr": "2258",
    "name": "Siddhi Bharti",
    "rfid": "446"
  },
  {
    "sr": "2470",
    "name": "Vihan Mandloi",
    "rfid": "447"
  },
  {
    "sr": "2841",
    "name": "Yashwini Chouhan",
    "rfid": "448"
  },
  {
    "sr": "2991",
    "name": "Aarav Goswami",
    "rfid": "449"
  },
  {
    "sr": "3364",
    "name": "Aastha Singh",
    "rfid": "450"
  },
  {
    "sr": "2576",
    "name": "Aayush Parmar",
    "rfid": "451"
  },
  {
    "sr": "3503",
    "name": "Abhinav Patel",
    "rfid": "452"
  },
  {
    "sr": "2918",
    "name": "Advik Sharma",
    "rfid": "453"
  },
  {
    "sr": "3206",
    "name": "Ankush Gehlot",
    "rfid": "454"
  },
  {
    "sr": "3660",
    "name": "Anmol Rathore",
    "rfid": "455"
  },
  {
    "sr": "3740",
    "name": "Arpan Dwivedi",
    "rfid": "456"
  },
  {
    "sr": "3555",
    "name": "Divy Patel",
    "rfid": "457"
  },
  {
    "sr": "2524",
    "name": "Harjot Singh Sohanpal",
    "rfid": "458"
  },
  {
    "sr": "2617",
    "name": "Harshit Dhakrey",
    "rfid": "459"
  },
  {
    "sr": "3007",
    "name": "Ilyana Khan",
    "rfid": "460"
  },
  {
    "sr": "2594",
    "name": "Jaya Choudhary",
    "rfid": "461"
  },
  {
    "sr": "2436",
    "name": "Jayesh Choudhary",
    "rfid": "462"
  },
  {
    "sr": "2221",
    "name": "Kunal  Jatav",
    "rfid": "463"
  },
  {
    "sr": "2602",
    "name": "Lakshya Dubey",
    "rfid": "464"
  },
  {
    "sr": "2874",
    "name": "Mayank Khilawadiya",
    "rfid": "465"
  },
  {
    "sr": "3479",
    "name": "Medhansh Das",
    "rfid": "466"
  },
  {
    "sr": "3719",
    "name": "Namrata Raut",
    "rfid": "467"
  },
  {
    "sr": "2738",
    "name": "Preet Yadav",
    "rfid": "468"
  },
  {
    "sr": "3390",
    "name": "Puspendra Singh",
    "rfid": "469"
  },
  {
    "sr": "2296",
    "name": "Raghuveer Raghuvanshi",
    "rfid": "470"
  },
  {
    "sr": "3029",
    "name": "Ranveer Gehlot",
    "rfid": "471"
  },
  {
    "sr": "2244",
    "name": "Sheetal Yadav",
    "rfid": "472"
  },
  {
    "sr": "3568",
    "name": "Tilak Sisodiya",
    "rfid": "473"
  },
  {
    "sr": "3571",
    "name": "Vivan Yadav",
    "rfid": "474"
  },
  {
    "sr": "2968",
    "name": "Yogita Parmar",
    "rfid": "475"
  },
  {
    "sr": "2295",
    "name": "Yogyata Raghuvanshi",
    "rfid": "476"
  },
  {
    "sr": "2676",
    "name": "Aardhya Kanungo",
    "rfid": "477"
  },
  {
    "sr": "2111",
    "name": "Aditya Sharma",
    "rfid": "478"
  },
  {
    "sr": "3110",
    "name": "Aman Goud",
    "rfid": "479"
  },
  {
    "sr": "3512",
    "name": "Ananya Panchal",
    "rfid": "480"
  },
  {
    "sr": "3131",
    "name": "Ansh Makwana",
    "rfid": "481"
  },
  {
    "sr": "3563",
    "name": "Anurag Lavavanshi",
    "rfid": "482"
  },
  {
    "sr": "2358",
    "name": "Anvesha Raghuvanshi",
    "rfid": "483"
  },
  {
    "sr": "3738",
    "name": "Ashutosh Tripathi",
    "rfid": "484"
  },
  {
    "sr": "3231",
    "name": "Bhavya Amrute",
    "rfid": "485"
  },
  {
    "sr": "3585",
    "name": "Dhruv Sharma",
    "rfid": "486"
  },
  {
    "sr": "2157",
    "name": "Dipesh Raghuvanshi",
    "rfid": "487"
  },
  {
    "sr": "3549",
    "name": "Divy Jain",
    "rfid": "488"
  },
  {
    "sr": "2155",
    "name": "Divya Raghuvanshi",
    "rfid": "489"
  },
  {
    "sr": "2307",
    "name": "Dixita Solanki",
    "rfid": "490"
  },
  {
    "sr": "2672",
    "name": "Faizan Ahmed",
    "rfid": "491"
  },
  {
    "sr": "2826",
    "name": "Gouri Jatwa",
    "rfid": "492"
  },
  {
    "sr": "2649",
    "name": "Goutam Chouhan",
    "rfid": "493"
  },
  {
    "sr": "3715",
    "name": "Harshita Chouhan",
    "rfid": "494"
  },
  {
    "sr": "2193",
    "name": "Kushveer Singh Chouhan",
    "rfid": "495"
  },
  {
    "sr": "2978",
    "name": "Mandar Dubey",
    "rfid": "496"
  },
  {
    "sr": "2669",
    "name": "Mitansh Makwana",
    "rfid": "497"
  },
  {
    "sr": "3737",
    "name": "Mohit Suner",
    "rfid": "498"
  },
  {
    "sr": "3125",
    "name": "Pratik Patel",
    "rfid": "499"
  },
  {
    "sr": "2679",
    "name": "Prince Kewat",
    "rfid": "500"
  },
  {
    "sr": "2865",
    "name": "Purv Jat Choudhary",
    "rfid": "501"
  },
  {
    "sr": "2930",
    "name": "Purvi Sharma",
    "rfid": "502"
  },
  {
    "sr": "2677",
    "name": "Riya Sampla",
    "rfid": "503"
  },
  {
    "sr": "3596",
    "name": "Sarvee Jain",
    "rfid": "504"
  },
  {
    "sr": "3418",
    "name": "Shubham Sheliwal",
    "rfid": "505"
  },
  {
    "sr": "2121",
    "name": "Tanish Kothari",
    "rfid": "506"
  },
  {
    "sr": "2663",
    "name": "Tavishi Sharma",
    "rfid": "507"
  },
  {
    "sr": "3109",
    "name": "Vaidik Chouhan",
    "rfid": "508"
  },
  {
    "sr": "2235",
    "name": "Aahil Ahmed Khan",
    "rfid": "509"
  },
  {
    "sr": "3743",
    "name": "Aaryan Wankhade",
    "rfid": "510"
  },
  {
    "sr": "3371",
    "name": "Aradhya Tyagi",
    "rfid": "511"
  },
  {
    "sr": "2564",
    "name": "Argh Jain",
    "rfid": "512"
  },
  {
    "sr": "2090",
    "name": "Deepankar Jena",
    "rfid": "513"
  },
  {
    "sr": "3217",
    "name": "Divyansh Chandel",
    "rfid": "514"
  },
  {
    "sr": "3661",
    "name": "Divyansh Parihar",
    "rfid": "515"
  },
  {
    "sr": "3355",
    "name": "Giriraj Choudhary",
    "rfid": "516"
  },
  {
    "sr": "2958",
    "name": "Ishika Chouhan",
    "rfid": "517"
  },
  {
    "sr": "2673",
    "name": "Kamran Ahmed",
    "rfid": "518"
  },
  {
    "sr": "3158",
    "name": "Kanchan Jirati",
    "rfid": "519"
  },
  {
    "sr": "3546",
    "name": "Kartik Thakur",
    "rfid": "520"
  },
  {
    "sr": "2731",
    "name": "Khushi Solanki",
    "rfid": "521"
  },
  {
    "sr": "2960",
    "name": "Lakshya Vishwakarma",
    "rfid": "522"
  },
  {
    "sr": "2668",
    "name": "Moksha Kothari",
    "rfid": "523"
  },
  {
    "sr": "3144",
    "name": "Naitik Gehlot",
    "rfid": "524"
  },
  {
    "sr": "3227",
    "name": "Nitansh Jain",
    "rfid": "525"
  },
  {
    "sr": "3094",
    "name": "Rachit Kothari",
    "rfid": "526"
  },
  {
    "sr": "3515",
    "name": "Raj Bairagi",
    "rfid": "527"
  },
  {
    "sr": "2727",
    "name": "Rajat Makwana",
    "rfid": "528"
  },
  {
    "sr": "2242",
    "name": "Rajvi Sule",
    "rfid": "529"
  },
  {
    "sr": "3348",
    "name": "Rituraj Mourya",
    "rfid": "530"
  },
  {
    "sr": "3621",
    "name": "Rudra",
    "rfid": "531"
  },
  {
    "sr": "3464",
    "name": "Saksham Panwar",
    "rfid": "532"
  },
  {
    "sr": "3527",
    "name": "Samarth Srivastava",
    "rfid": "533"
  },
  {
    "sr": "2820",
    "name": "Shivansh Vishwakarma",
    "rfid": "534"
  },
  {
    "sr": "2640",
    "name": "Sourya Mishra",
    "rfid": "535"
  },
  {
    "sr": "2008",
    "name": "Vansh Choudhary",
    "rfid": "536"
  },
  {
    "sr": "2977",
    "name": "Varad Dubey",
    "rfid": "537"
  },
  {
    "sr": "3032",
    "name": "Virat Panwar",
    "rfid": "538"
  },
  {
    "sr": "3599",
    "name": "Aarna Parihar",
    "rfid": "539"
  },
  {
    "sr": "2741",
    "name": "Aarush Badwaya",
    "rfid": "540"
  },
  {
    "sr": "2810",
    "name": "Anuj Jatwa",
    "rfid": "541"
  },
  {
    "sr": "3417",
    "name": "Anushka Raghuvanshi",
    "rfid": "542"
  },
  {
    "sr": "2816",
    "name": "Aradhya Tiwari",
    "rfid": "543"
  },
  {
    "sr": "3498",
    "name": "Ayansh Joshi",
    "rfid": "544"
  },
  {
    "sr": "2372",
    "name": "Kabir Maida",
    "rfid": "545"
  },
  {
    "sr": "2128",
    "name": "Kanak Jirati",
    "rfid": "546"
  },
  {
    "sr": "3463",
    "name": "Krishna Johari",
    "rfid": "547"
  },
  {
    "sr": "2666",
    "name": "Kriti Singh",
    "rfid": "548"
  },
  {
    "sr": "3216",
    "name": "Kuldeep Solanki",
    "rfid": "549"
  },
  {
    "sr": "3652",
    "name": "Lakshyaraj Singh Tanwar",
    "rfid": "550"
  },
  {
    "sr": "3718",
    "name": "Meetraj Chouhan",
    "rfid": "551"
  },
  {
    "sr": "2168",
    "name": "Naman Jakhetiya",
    "rfid": "552"
  },
  {
    "sr": "3068",
    "name": "Nihit Joshi",
    "rfid": "553"
  },
  {
    "sr": "3444",
    "name": "Nitesh Panwar",
    "rfid": "554"
  },
  {
    "sr": "3157",
    "name": "Rajvansh Solanki",
    "rfid": "555"
  },
  {
    "sr": "3056",
    "name": "Rajveer Parihar",
    "rfid": "556"
  },
  {
    "sr": "2508",
    "name": "Ranveer Singh Chouhan",
    "rfid": "557"
  },
  {
    "sr": "3523",
    "name": "Rishrika Patel",
    "rfid": "558"
  },
  {
    "sr": "3183",
    "name": "Sneha Ojha",
    "rfid": "559"
  },
  {
    "sr": "2086",
    "name": "Soumya Kamdar",
    "rfid": "560"
  },
  {
    "sr": "3646",
    "name": "Urvashi Thakur",
    "rfid": "561"
  },
  {
    "sr": "3601",
    "name": "Vaibhav Raj Singh Sisodiya",
    "rfid": "562"
  },
  {
    "sr": "2730",
    "name": "Vaishnavi Patidar",
    "rfid": "563"
  },
  {
    "sr": "2165",
    "name": "Vansh Choudhary",
    "rfid": "564"
  },
  {
    "sr": "2124",
    "name": "Vishvaditya Ghorpade",
    "rfid": "565"
  },
  {
    "sr": "3513",
    "name": "Yashika Rathore",
    "rfid": "566"
  },
  {
    "sr": "2866",
    "name": "Yashraj Giri",
    "rfid": "567"
  },
  {
    "sr": "2701",
    "name": "Yug Jat",
    "rfid": "568"
  },
  {
    "sr": "2817",
    "name": "Aarya Tiwari",
    "rfid": "569"
  },
  {
    "sr": "3489",
    "name": "Abhijay Borkhediya",
    "rfid": "570"
  },
  {
    "sr": "1855",
    "name": "Akshat Panwar",
    "rfid": "571"
  },
  {
    "sr": "3129",
    "name": "Anant Solanki",
    "rfid": "572"
  },
  {
    "sr": "2840",
    "name": "Ananya Chouhan",
    "rfid": "573"
  },
  {
    "sr": "1955",
    "name": "Anaya Dhamani",
    "rfid": "574"
  },
  {
    "sr": "3477",
    "name": "Ansh Dubey",
    "rfid": "575"
  },
  {
    "sr": "3736",
    "name": "Anshu Suner",
    "rfid": "576"
  },
  {
    "sr": "2578",
    "name": "Anvi Chaturvedi",
    "rfid": "577"
  },
  {
    "sr": "1900",
    "name": "Aradhya Chharodi",
    "rfid": "578"
  },
  {
    "sr": "3016",
    "name": "Daksh Sonone",
    "rfid": "579"
  },
  {
    "sr": "2446",
    "name": "Dhruv Makwana",
    "rfid": "580"
  },
  {
    "sr": "2019",
    "name": "Ishita Verma",
    "rfid": "581"
  },
  {
    "sr": "3626",
    "name": "Mohd. Numer Chhipa",
    "rfid": "582"
  },
  {
    "sr": "2410",
    "name": "Nancy Parmar",
    "rfid": "583"
  },
  {
    "sr": "3757",
    "name": "Navneet Verma",
    "rfid": "584"
  },
  {
    "sr": "2334",
    "name": "Neer Tiwari",
    "rfid": "585"
  },
  {
    "sr": "3186",
    "name": "Niral Joshi",
    "rfid": "586"
  },
  {
    "sr": "3189",
    "name": "Parth Mourya",
    "rfid": "587"
  },
  {
    "sr": "2806",
    "name": "Prayag Nagar",
    "rfid": "588"
  },
  {
    "sr": "2378",
    "name": "Priyanshu Patra",
    "rfid": "589"
  },
  {
    "sr": "3672",
    "name": "Raj Choudhary",
    "rfid": "590"
  },
  {
    "sr": "3335",
    "name": "Rajiv Parihar",
    "rfid": "591"
  },
  {
    "sr": "2035",
    "name": "Rajveer Rathore",
    "rfid": "592"
  },
  {
    "sr": "2808",
    "name": "Shivam Yadav",
    "rfid": "593"
  },
  {
    "sr": "1974",
    "name": "Swastik Salunke",
    "rfid": "594"
  },
  {
    "sr": "3077",
    "name": "Umang Singh Kamdar",
    "rfid": "595"
  },
  {
    "sr": "3711",
    "name": "Vaibhav Singh Rathore",
    "rfid": "596"
  },
  {
    "sr": "1911",
    "name": "Yashas V. Naik",
    "rfid": "597"
  },
  {
    "sr": "1980",
    "name": "Abeer Jirati",
    "rfid": "598"
  },
  {
    "sr": "3482",
    "name": "Aditya Kumar Pandey",
    "rfid": "599"
  },
  {
    "sr": "1951",
    "name": "Aradhya Yadav",
    "rfid": "600"
  },
  {
    "sr": "3197",
    "name": "Atharv Panchal",
    "rfid": "601"
  },
  {
    "sr": "2046",
    "name": "Bhavya Agrawal",
    "rfid": "602"
  },
  {
    "sr": "2398",
    "name": "Devraj Makwana",
    "rfid": "603"
  },
  {
    "sr": "2562",
    "name": "Dikshant Choudhary",
    "rfid": "604"
  },
  {
    "sr": "3234",
    "name": "Divyansh Prajapati",
    "rfid": "605"
  },
  {
    "sr": "1918",
    "name": "Faiz Ahmed Khan",
    "rfid": "606"
  },
  {
    "sr": "2756",
    "name": "Geet Barnashiya",
    "rfid": "607"
  },
  {
    "sr": "3103",
    "name": "Harsh Makwana",
    "rfid": "608"
  },
  {
    "sr": "3502",
    "name": "Hemant Jat",
    "rfid": "609"
  },
  {
    "sr": "2929",
    "name": "Himanshu Sharma",
    "rfid": "610"
  },
  {
    "sr": "1985",
    "name": "Janamjay Singh Rajawat",
    "rfid": "611"
  },
  {
    "sr": "2236",
    "name": "Jaspreet Saini",
    "rfid": "612"
  },
  {
    "sr": "2924",
    "name": "Kashish Kumrawat",
    "rfid": "613"
  },
  {
    "sr": "1944",
    "name": "Mihika Choudhary",
    "rfid": "614"
  },
  {
    "sr": "2618",
    "name": "Mohit Dhakrey",
    "rfid": "615"
  },
  {
    "sr": "3586",
    "name": "Nahush Joshi",
    "rfid": "616"
  },
  {
    "sr": "2747",
    "name": "Pransh Yadav",
    "rfid": "617"
  },
  {
    "sr": "3065",
    "name": "Pratik Patel",
    "rfid": "618"
  },
  {
    "sr": "1994",
    "name": "Prince Jirati",
    "rfid": "619"
  },
  {
    "sr": "3349",
    "name": "Priyanshi",
    "rfid": "620"
  },
  {
    "sr": "2634",
    "name": "Radhika Solanki",
    "rfid": "621"
  },
  {
    "sr": "3591",
    "name": "Raghav Karma",
    "rfid": "622"
  },
  {
    "sr": "2641",
    "name": "Rishabh Singh Sengar",
    "rfid": "623"
  },
  {
    "sr": "2546",
    "name": "Suraj Rathore",
    "rfid": "624"
  },
  {
    "sr": "2462",
    "name": "Veena Panwar",
    "rfid": "625"
  },
  {
    "sr": "2922",
    "name": "Yuvraj Hawaldar",
    "rfid": "626"
  },
  {
    "sr": "1983",
    "name": "Aarav Patel",
    "rfid": "627"
  },
  {
    "sr": "2328",
    "name": "Anima Garain",
    "rfid": "628"
  },
  {
    "sr": "3365",
    "name": "Anmol Parihar",
    "rfid": "629"
  },
  {
    "sr": "2871",
    "name": "Atharw Rajput",
    "rfid": "630"
  },
  {
    "sr": "3031",
    "name": "Divyansh Gehlot",
    "rfid": "631"
  },
  {
    "sr": "2339",
    "name": "Dushyant Thakur",
    "rfid": "632"
  },
  {
    "sr": "1961",
    "name": "Harsh Badodiya",
    "rfid": "633"
  },
  {
    "sr": "2084",
    "name": "Harshal Choudhary",
    "rfid": "634"
  },
  {
    "sr": "2333",
    "name": "Harshita Singh",
    "rfid": "635"
  },
  {
    "sr": "2949",
    "name": "Janvi Chouhan",
    "rfid": "636"
  },
  {
    "sr": "2758",
    "name": "Lishika Mishra",
    "rfid": "637"
  },
  {
    "sr": "3015",
    "name": "Mahitika Jamod",
    "rfid": "638"
  },
  {
    "sr": "1899",
    "name": "Naksh Choudhary",
    "rfid": "639"
  },
  {
    "sr": "3003",
    "name": "Parikshit Patil",
    "rfid": "640"
  },
  {
    "sr": "3014",
    "name": "Praveen Makwana",
    "rfid": "641"
  },
  {
    "sr": "2847",
    "name": "Prince Rathore",
    "rfid": "642"
  },
  {
    "sr": "2760",
    "name": "Rajat Solanki",
    "rfid": "643"
  },
  {
    "sr": "2614",
    "name": "Sarthak Gupta",
    "rfid": "644"
  },
  {
    "sr": "3346",
    "name": "Shivam Mourya",
    "rfid": "645"
  },
  {
    "sr": "2136",
    "name": "Shouryaditya Chouhan",
    "rfid": "646"
  },
  {
    "sr": "3483",
    "name": "Shree Ram Khanve",
    "rfid": "647"
  },
  {
    "sr": "2456",
    "name": "Tulsi Jadhav",
    "rfid": "648"
  },
  {
    "sr": "2694",
    "name": "Umang Makwana",
    "rfid": "649"
  },
  {
    "sr": "1957",
    "name": "Viram Raghuwanshi",
    "rfid": "650"
  },
  {
    "sr": "1981",
    "name": "Virendra Choudhary",
    "rfid": "651"
  },
  {
    "sr": "2823",
    "name": "Aaradhy Singh Baghel",
    "rfid": "652"
  },
  {
    "sr": "2448",
    "name": "Aaradhya Rathore",
    "rfid": "653"
  },
  {
    "sr": "2036",
    "name": "Abhiraj Mandloi",
    "rfid": "654"
  },
  {
    "sr": "1778",
    "name": "Angel Parihar",
    "rfid": "655"
  },
  {
    "sr": "3629",
    "name": "Aniket Rathore",
    "rfid": "656"
  },
  {
    "sr": "2877",
    "name": "Ansh Yadav",
    "rfid": "657"
  },
  {
    "sr": "2976",
    "name": "Anshuman Yadav",
    "rfid": "658"
  },
  {
    "sr": "3641",
    "name": "Badal  Makwana",
    "rfid": "659"
  },
  {
    "sr": "1798",
    "name": "Bhagyashree Gehlod",
    "rfid": "660"
  },
  {
    "sr": "2909",
    "name": "Himanshu Singh",
    "rfid": "661"
  },
  {
    "sr": "1836",
    "name": "Ishayu Solanki",
    "rfid": "662"
  },
  {
    "sr": "2878",
    "name": "Jeevika Jatwa",
    "rfid": "663"
  },
  {
    "sr": "3342",
    "name": "Kalash Wankhede",
    "rfid": "664"
  },
  {
    "sr": "3741",
    "name": "Kamleshi",
    "rfid": "665"
  },
  {
    "sr": "1787",
    "name": "Kanishka Choudhary",
    "rfid": "666"
  },
  {
    "sr": "1751",
    "name": "Kaushal Singh Sisodiya",
    "rfid": "667"
  },
  {
    "sr": "2961",
    "name": "Manit Jain",
    "rfid": "668"
  },
  {
    "sr": "3755",
    "name": "Mayank Thakur",
    "rfid": "669"
  },
  {
    "sr": "2144",
    "name": "Mohammad Noman",
    "rfid": "670"
  },
  {
    "sr": "2150",
    "name": "Naitik Doad",
    "rfid": "671"
  },
  {
    "sr": "3566",
    "name": "Naitik Solanki",
    "rfid": "672"
  },
  {
    "sr": "3413",
    "name": "Narayan Songara",
    "rfid": "673"
  },
  {
    "sr": "2656",
    "name": "Navi Singh Chauhan",
    "rfid": "674"
  },
  {
    "sr": "2180",
    "name": "Parish Raghuvanshi",
    "rfid": "675"
  },
  {
    "sr": "3373",
    "name": "Prince Parmar",
    "rfid": "676"
  },
  {
    "sr": "3345",
    "name": "Pritam Mourya",
    "rfid": "677"
  },
  {
    "sr": "2946",
    "name": "Purab Bairagi",
    "rfid": "678"
  },
  {
    "sr": "1919",
    "name": "Rachitendra Joshi",
    "rfid": "679"
  },
  {
    "sr": "2790",
    "name": "Rajvardhan Goud",
    "rfid": "680"
  },
  {
    "sr": "3597",
    "name": "Rajveer Singh Jawara",
    "rfid": "681"
  },
  {
    "sr": "3653",
    "name": "Ridansh Songara",
    "rfid": "682"
  },
  {
    "sr": "1795",
    "name": "Ritveer Yadav",
    "rfid": "683"
  },
  {
    "sr": "3500",
    "name": "Sanidhy Joshi",
    "rfid": "684"
  },
  {
    "sr": "3076",
    "name": "Shivam Kamdar",
    "rfid": "685"
  },
  {
    "sr": "3017",
    "name": "Shivani Thakur",
    "rfid": "686"
  },
  {
    "sr": "1767",
    "name": "Shravani Ghorpade",
    "rfid": "687"
  },
  {
    "sr": "1766",
    "name": "Stuti Patidar",
    "rfid": "688"
  },
  {
    "sr": "3048",
    "name": "Vansh Choudhary",
    "rfid": "689"
  },
  {
    "sr": "3505",
    "name": "Varnika Verma",
    "rfid": "690"
  },
  {
    "sr": "2947",
    "name": "Viha Nagar",
    "rfid": "691"
  },
  {
    "sr": "1872",
    "name": "Zeeshan Sheikh",
    "rfid": "692"
  },
  {
    "sr": "2021",
    "name": "Aaryan Chhadodi",
    "rfid": "693"
  },
  {
    "sr": "3138",
    "name": "Aditya Jat",
    "rfid": "694"
  },
  {
    "sr": "2973",
    "name": "Alka Singh",
    "rfid": "695"
  },
  {
    "sr": "2651",
    "name": "Ambuj Rai",
    "rfid": "696"
  },
  {
    "sr": "2898",
    "name": "Angel Bairagi",
    "rfid": "697"
  },
  {
    "sr": "3038",
    "name": "Ansh Solanki",
    "rfid": "698"
  },
  {
    "sr": "3739",
    "name": "Anshik Dwivedi",
    "rfid": "699"
  },
  {
    "sr": "1832",
    "name": "Arzan Khan",
    "rfid": "700"
  },
  {
    "sr": "3185",
    "name": "Avika Joshi",
    "rfid": "701"
  },
  {
    "sr": "3151",
    "name": "Ayush Singh",
    "rfid": "702"
  },
  {
    "sr": "1940",
    "name": "Bhavya Chouhan",
    "rfid": "703"
  },
  {
    "sr": "3707",
    "name": "Bhavya Pathe",
    "rfid": "704"
  },
  {
    "sr": "3640",
    "name": "Hariom Sankla",
    "rfid": "705"
  },
  {
    "sr": "1777",
    "name": "Izhaan Shah",
    "rfid": "706"
  },
  {
    "sr": "2547",
    "name": "Kanchan Rathore",
    "rfid": "707"
  },
  {
    "sr": "3747",
    "name": "Love Rathore",
    "rfid": "708"
  },
  {
    "sr": "2310",
    "name": "Mayank Chhadodi",
    "rfid": "709"
  },
  {
    "sr": "1833",
    "name": "Modak Kumrawat",
    "rfid": "710"
  },
  {
    "sr": "1908",
    "name": "Mudit Dandwate",
    "rfid": "711"
  },
  {
    "sr": "3124",
    "name": "Naitik Patel",
    "rfid": "712"
  },
  {
    "sr": "2637",
    "name": "Naivedhya Sharma",
    "rfid": "713"
  },
  {
    "sr": "2059",
    "name": "Nikita Kumrawat",
    "rfid": "714"
  },
  {
    "sr": "2706",
    "name": "Parag Verma",
    "rfid": "715"
  },
  {
    "sr": "2705",
    "name": "Pari Verma",
    "rfid": "716"
  },
  {
    "sr": "3713",
    "name": "Prathviraj Jawra",
    "rfid": "717"
  },
  {
    "sr": "2610",
    "name": "Puneet Jat",
    "rfid": "718"
  },
  {
    "sr": "3111",
    "name": "Raj Choudhary",
    "rfid": "719"
  },
  {
    "sr": "2774",
    "name": "Rajeev Yadav",
    "rfid": "720"
  },
  {
    "sr": "2013",
    "name": "Shireen Mirda",
    "rfid": "721"
  },
  {
    "sr": "2881",
    "name": "Simran Solanki",
    "rfid": "722"
  },
  {
    "sr": "1995",
    "name": "Sobaran Singh Rana",
    "rfid": "723"
  },
  {
    "sr": "3744",
    "name": "Tanikesh Mourya",
    "rfid": "724"
  },
  {
    "sr": "3045",
    "name": "Tanishk Choudhary",
    "rfid": "725"
  },
  {
    "sr": "3609",
    "name": "Trisha Singh",
    "rfid": "726"
  },
  {
    "sr": "2249",
    "name": "Unnati Nagar",
    "rfid": "727"
  },
  {
    "sr": "2404",
    "name": "Vedansh Patel",
    "rfid": "728"
  },
  {
    "sr": "2197",
    "name": "Vedant Rathore",
    "rfid": "729"
  },
  {
    "sr": "3141",
    "name": "Vinay Makwana",
    "rfid": "730"
  },
  {
    "sr": "2543",
    "name": "Vinita Mourya",
    "rfid": "731"
  },
  {
    "sr": "1842",
    "name": "Yash Badodiya",
    "rfid": "732"
  },
  {
    "sr": "3627",
    "name": "Aaryan Mourya",
    "rfid": "733"
  },
  {
    "sr": "3476",
    "name": "Aarzoo Parveen",
    "rfid": "734"
  },
  {
    "sr": "1527",
    "name": "Aditya Rathore",
    "rfid": "735"
  },
  {
    "sr": "1582",
    "name": "Aishwary Maheshwari",
    "rfid": "736"
  },
  {
    "sr": "2915",
    "name": "Anokhi Singh",
    "rfid": "737"
  },
  {
    "sr": "2502",
    "name": "Aryan Kushwaha",
    "rfid": "738"
  },
  {
    "sr": "2998",
    "name": "Chahat Verma",
    "rfid": "739"
  },
  {
    "sr": "2340",
    "name": "Devraj Dhakad",
    "rfid": "740"
  },
  {
    "sr": "2717",
    "name": "Harsh Sharma",
    "rfid": "741"
  },
  {
    "sr": "2048",
    "name": "Harshita Maida",
    "rfid": "742"
  },
  {
    "sr": "3471",
    "name": "Harshvardhan Singh Rajput",
    "rfid": "743"
  },
  {
    "sr": "2322",
    "name": "Jaydeep Yadav",
    "rfid": "744"
  },
  {
    "sr": "3117",
    "name": "Kartik Raghuvanshi",
    "rfid": "745"
  },
  {
    "sr": "1556",
    "name": "Keshvi Kumrawat",
    "rfid": "746"
  },
  {
    "sr": "3162",
    "name": "Kuldeep Chouhan",
    "rfid": "747"
  },
  {
    "sr": "1526",
    "name": "Manvi Jain",
    "rfid": "748"
  },
  {
    "sr": "3450",
    "name": "Mohit Singh Chouhan",
    "rfid": "749"
  },
  {
    "sr": "2725",
    "name": "Navya Rathore",
    "rfid": "750"
  },
  {
    "sr": "1555",
    "name": "Parv Garg",
    "rfid": "751"
  },
  {
    "sr": "2421",
    "name": "Pratik Aleriya",
    "rfid": "752"
  },
  {
    "sr": "3232",
    "name": "Priyanshi Amrute",
    "rfid": "753"
  },
  {
    "sr": "2037",
    "name": "Raghav Agrawal",
    "rfid": "754"
  },
  {
    "sr": "1553",
    "name": "Riddhima Chouhan",
    "rfid": "755"
  },
  {
    "sr": "2631",
    "name": "Ridhima Mathur",
    "rfid": "756"
  },
  {
    "sr": "2595",
    "name": "Samanyu Tripathi",
    "rfid": "757"
  },
  {
    "sr": "2927",
    "name": "Sarthak Jujar",
    "rfid": "758"
  },
  {
    "sr": "1733",
    "name": "Shirin Sheikh",
    "rfid": "759"
  },
  {
    "sr": "3712",
    "name": "Shivam Devda",
    "rfid": "760"
  },
  {
    "sr": "1554",
    "name": "Shresth Kothari",
    "rfid": "761"
  },
  {
    "sr": "2522",
    "name": "Sonakshi Singh",
    "rfid": "762"
  },
  {
    "sr": "2739",
    "name": "Suhani Mangal",
    "rfid": "763"
  },
  {
    "sr": "2955",
    "name": "Vaibhav Dangi",
    "rfid": "764"
  },
  {
    "sr": "2697",
    "name": "Vanshraj Singh Panwar",
    "rfid": "765"
  },
  {
    "sr": "2803",
    "name": "Veer Rathore",
    "rfid": "766"
  },
  {
    "sr": "2964",
    "name": "Yashwardhan Singh Panwar",
    "rfid": "767"
  },
  {
    "sr": "2134",
    "name": "Abhijeet Singh Jat",
    "rfid": "768"
  },
  {
    "sr": "2073",
    "name": "Anish Jadhav",
    "rfid": "769"
  },
  {
    "sr": "2389",
    "name": "Aparna Baghel",
    "rfid": "770"
  },
  {
    "sr": "3093",
    "name": "Avi Kothari",
    "rfid": "771"
  },
  {
    "sr": "3557",
    "name": "Azmal Ali",
    "rfid": "772"
  },
  {
    "sr": "1737",
    "name": "Deepika Jirati",
    "rfid": "773"
  },
  {
    "sr": "1736",
    "name": "Divyam Gehlot",
    "rfid": "774"
  },
  {
    "sr": "2980",
    "name": "Harshita Chouhan",
    "rfid": "775"
  },
  {
    "sr": "2733",
    "name": "Harshita Jat",
    "rfid": "776"
  },
  {
    "sr": "1847",
    "name": "Himanshu Patel",
    "rfid": "777"
  },
  {
    "sr": "2734",
    "name": "Hiten Jat",
    "rfid": "778"
  },
  {
    "sr": "1839",
    "name": "Jayvardhan Kachhava",
    "rfid": "779"
  },
  {
    "sr": "3028",
    "name": "Kawyansh Goyal",
    "rfid": "780"
  },
  {
    "sr": "2601",
    "name": "Khushi Dubey",
    "rfid": "781"
  },
  {
    "sr": "3025",
    "name": "Krishna Chouhan",
    "rfid": "782"
  },
  {
    "sr": "1735",
    "name": "Lashika Parmar",
    "rfid": "783"
  },
  {
    "sr": "1968",
    "name": "Naitik Patel",
    "rfid": "784"
  },
  {
    "sr": "3105",
    "name": "Naitik Raghuvanshi",
    "rfid": "785"
  },
  {
    "sr": "1769",
    "name": "Namya Rai",
    "rfid": "786"
  },
  {
    "sr": "3395",
    "name": "Parth Songara",
    "rfid": "787"
  },
  {
    "sr": "2348",
    "name": "Rahul Raghuvanshi",
    "rfid": "788"
  },
  {
    "sr": "2695",
    "name": "Ritika Makwana",
    "rfid": "789"
  },
  {
    "sr": "3580",
    "name": "Riya Chouhan",
    "rfid": "790"
  },
  {
    "sr": "2256",
    "name": "Sakshi Bharti",
    "rfid": "791"
  },
  {
    "sr": "3554",
    "name": "Shivam Kumar Shriwastav",
    "rfid": "792"
  },
  {
    "sr": "2801",
    "name": "Shourya Pratap Singh Goud",
    "rfid": "793"
  },
  {
    "sr": "2117",
    "name": "Swadheen Nayak",
    "rfid": "794"
  },
  {
    "sr": "1732",
    "name": "Trilok Makwana",
    "rfid": "795"
  },
  {
    "sr": "2492",
    "name": "Trisha Yadav",
    "rfid": "796"
  },
  {
    "sr": "1734",
    "name": "Tushar Singh",
    "rfid": "797"
  },
  {
    "sr": "3682",
    "name": "Vikrant Baghel",
    "rfid": "798"
  },
  {
    "sr": "1528",
    "name": "Vinay Chouhan",
    "rfid": "799"
  },
  {
    "sr": "2921",
    "name": "Vishal Hawaldar",
    "rfid": "800"
  },
  {
    "sr": "2552",
    "name": "Yogendra Choudhary",
    "rfid": "801"
  },
  {
    "sr": "3306",
    "name": "Bhumi Tanwar",
    "rfid": "802"
  },
  {
    "sr": "3327",
    "name": "Deeksha Jain",
    "rfid": "803"
  },
  {
    "sr": "1464",
    "name": "Anjali Jat",
    "rfid": "804"
  },
  {
    "sr": "3760",
    "name": "Arihant Rathore",
    "rfid": "805"
  },
  {
    "sr": "3749",
    "name": "Arpit Bharti",
    "rfid": "806"
  },
  {
    "sr": "1703",
    "name": "Aryan Mukati",
    "rfid": "807"
  },
  {
    "sr": "2939",
    "name": "Atharv Soni",
    "rfid": "808"
  },
  {
    "sr": "2162",
    "name": "Ayush Raghuvanshi",
    "rfid": "809"
  },
  {
    "sr": "1390",
    "name": "Daksh Jatav",
    "rfid": "810"
  },
  {
    "sr": "1669",
    "name": "Deepak Raghuvanshi",
    "rfid": "811"
  },
  {
    "sr": "1640",
    "name": "Devendra Gehlot",
    "rfid": "812"
  },
  {
    "sr": "2309",
    "name": "Durgesh Jat",
    "rfid": "813"
  },
  {
    "sr": "3191",
    "name": "Edha Singhal",
    "rfid": "814"
  },
  {
    "sr": "3746",
    "name": "Harsh Patel",
    "rfid": "815"
  },
  {
    "sr": "2133",
    "name": "Hitesh Raghuvanshi",
    "rfid": "816"
  },
  {
    "sr": "2280",
    "name": "Mahim Yadav",
    "rfid": "817"
  },
  {
    "sr": "2750",
    "name": "Mohammad Arsh Khan",
    "rfid": "818"
  },
  {
    "sr": "3208",
    "name": "Mohit Rathore",
    "rfid": "819"
  },
  {
    "sr": "2392",
    "name": "Prakhar Tiwari",
    "rfid": "820"
  },
  {
    "sr": "3235",
    "name": "Purvi Garg",
    "rfid": "821"
  },
  {
    "sr": "2936",
    "name": "Raghvendra Singh Jat",
    "rfid": "822"
  },
  {
    "sr": "1394",
    "name": "Sachin Singh Dawar",
    "rfid": "823"
  },
  {
    "sr": "2182",
    "name": "Samarth Raghuvanshi",
    "rfid": "824"
  },
  {
    "sr": "2131",
    "name": "Samiksha Raghuvanshi",
    "rfid": "825"
  },
  {
    "sr": "1630",
    "name": "Shivraj Singh Chouhan",
    "rfid": "826"
  },
  {
    "sr": "2675",
    "name": "Somya Kanungo",
    "rfid": "827"
  },
  {
    "sr": "2132",
    "name": "Sonam Raghuvanshi",
    "rfid": "828"
  },
  {
    "sr": "1513",
    "name": "Tanish A. Jirati",
    "rfid": "829"
  },
  {
    "sr": "1891",
    "name": "Vedant Patidar",
    "rfid": "830"
  },
  {
    "sr": "2785",
    "name": "Vishal Chouhan",
    "rfid": "831"
  },
  {
    "sr": "3161",
    "name": "Aarav Patel",
    "rfid": "832"
  },
  {
    "sr": "1653",
    "name": "Anishka Raghuvanshi",
    "rfid": "833"
  },
  {
    "sr": "2765",
    "name": "Aryan Panwar",
    "rfid": "834"
  },
  {
    "sr": "2832",
    "name": "Devendra Jataw",
    "rfid": "835"
  },
  {
    "sr": "1693",
    "name": "Hardik Dubey",
    "rfid": "836"
  },
  {
    "sr": "1392",
    "name": "Kanak Jadhav",
    "rfid": "837"
  },
  {
    "sr": "2945",
    "name": "Keshav Bairagi",
    "rfid": "838"
  },
  {
    "sr": "2390",
    "name": "Kunal Singh Tanwar",
    "rfid": "839"
  },
  {
    "sr": "3079",
    "name": "Mohit Gurjar",
    "rfid": "840"
  },
  {
    "sr": "3034",
    "name": "Mohit Suner",
    "rfid": "841"
  },
  {
    "sr": "1659",
    "name": "Nitin Chouhan",
    "rfid": "842"
  },
  {
    "sr": "3033",
    "name": "Prathviraj Singh Suner",
    "rfid": "843"
  },
  {
    "sr": "3055",
    "name": "Shivam Parihar",
    "rfid": "844"
  },
  {
    "sr": "1524",
    "name": "Shriji Mishra",
    "rfid": "845"
  },
  {
    "sr": "2804",
    "name": "Siddhi Rathore",
    "rfid": "846"
  },
  {
    "sr": "1353",
    "name": "Tanish V. Jirati",
    "rfid": "847"
  },
  {
    "sr": "2684",
    "name": "Vansh Mukati",
    "rfid": "848"
  },
  {
    "sr": "2300",
    "name": "Yogesh Verma",
    "rfid": "849"
  },
  {
    "sr": "3392",
    "name": "Yuvraj Mourya",
    "rfid": "850"
  },
  {
    "sr": "3061",
    "name": "Aarushi Patel",
    "rfid": "851"
  },
  {
    "sr": "1758",
    "name": "Aarya Jena",
    "rfid": "852"
  },
  {
    "sr": "1666",
    "name": "Arush Sharma",
    "rfid": "853"
  },
  {
    "sr": "2503",
    "name": "Ayushi Kushwaha",
    "rfid": "854"
  },
  {
    "sr": "2849",
    "name": "Harsh Yadav",
    "rfid": "855"
  },
  {
    "sr": "2689",
    "name": "Jayesh Singh",
    "rfid": "856"
  },
  {
    "sr": "1606",
    "name": "Kratika Kadam",
    "rfid": "857"
  },
  {
    "sr": "1625",
    "name": "Mohammad Arfan Khan",
    "rfid": "858"
  },
  {
    "sr": "1605",
    "name": "Prisha Salunke",
    "rfid": "859"
  },
  {
    "sr": "1937",
    "name": "Shlok Makwana",
    "rfid": "860"
  },
  {
    "sr": "1707",
    "name": "Sumit Mishra",
    "rfid": "861"
  },
  {
    "sr": "2427",
    "name": "Vandana Pawar",
    "rfid": "862"
  },
  {
    "sr": "2569",
    "name": "Vedahi Soni",
    "rfid": "863"
  },
  {
    "sr": "2855",
    "name": "Vinay Nakum",
    "rfid": "864"
  },
  {
    "sr": "2491",
    "name": "Aarav Sharma",
    "rfid": "865"
  },
  {
    "sr": "1810",
    "name": "Abhijeet Choudhary",
    "rfid": "866"
  },
  {
    "sr": "1315",
    "name": "Adarsh Kamdar",
    "rfid": "867"
  },
  {
    "sr": "1680",
    "name": "Aditya Mourya",
    "rfid": "868"
  },
  {
    "sr": "1226",
    "name": "Akshara Kumrawat",
    "rfid": "869"
  },
  {
    "sr": "2910",
    "name": "Anjali Yadav",
    "rfid": "870"
  },
  {
    "sr": "3008",
    "name": "Anuj Parihar",
    "rfid": "871"
  },
  {
    "sr": "3156",
    "name": "Atharv Pratap Singh",
    "rfid": "872"
  },
  {
    "sr": "1286",
    "name": "Atharv Rathore",
    "rfid": "873"
  },
  {
    "sr": "1454",
    "name": "Bibek Nayak",
    "rfid": "874"
  },
  {
    "sr": "1550",
    "name": "Dhruv Patidar",
    "rfid": "875"
  },
  {
    "sr": "3153",
    "name": "Divyansh Kamdar",
    "rfid": "876"
  },
  {
    "sr": "2204",
    "name": "Divyansh Raghuvanshi",
    "rfid": "877"
  },
  {
    "sr": "2613",
    "name": "Harshita Gupta",
    "rfid": "878"
  },
  {
    "sr": "3122",
    "name": "Kanhaiya Parmar",
    "rfid": "879"
  },
  {
    "sr": "1692",
    "name": "Khushhal Chouhan",
    "rfid": "880"
  },
  {
    "sr": "1473",
    "name": "Krishna Patidar",
    "rfid": "881"
  },
  {
    "sr": "2181",
    "name": "Lishika Raghuvanshi",
    "rfid": "882"
  },
  {
    "sr": "2006",
    "name": "Moksh Bhandari",
    "rfid": "883"
  },
  {
    "sr": "1320",
    "name": "Naveen Rathod",
    "rfid": "884"
  },
  {
    "sr": "2772",
    "name": "Paramveer Singh Panwar",
    "rfid": "885"
  },
  {
    "sr": "1864",
    "name": "Parth Makwana",
    "rfid": "886"
  },
  {
    "sr": "2724",
    "name": "Parth Rathore",
    "rfid": "887"
  },
  {
    "sr": "3673",
    "name": "Piyush Kumar Nag",
    "rfid": "888"
  },
  {
    "sr": "2161",
    "name": "Piyush Raghuvanshi",
    "rfid": "889"
  },
  {
    "sr": "2308",
    "name": "Piyush Singh Solanki",
    "rfid": "890"
  },
  {
    "sr": "1366",
    "name": "Piyush Verma",
    "rfid": "891"
  },
  {
    "sr": "1299",
    "name": "Prakriti Mohanty",
    "rfid": "892"
  },
  {
    "sr": "1532",
    "name": "Princy Singh",
    "rfid": "893"
  },
  {
    "sr": "2248",
    "name": "Ridham Soni",
    "rfid": "894"
  },
  {
    "sr": "1277",
    "name": "Riya Verma",
    "rfid": "895"
  },
  {
    "sr": "2384",
    "name": "Rudra Mukati",
    "rfid": "896"
  },
  {
    "sr": "2255",
    "name": "Sharad Bharti",
    "rfid": "897"
  },
  {
    "sr": "3558",
    "name": "Shweta Yadav",
    "rfid": "898"
  },
  {
    "sr": "1300",
    "name": "Siddhi Jain",
    "rfid": "899"
  },
  {
    "sr": "2494",
    "name": "Sujal Khatri",
    "rfid": "900"
  },
  {
    "sr": "1702",
    "name": "Sumit Raghuvanshi",
    "rfid": "901"
  },
  {
    "sr": "3184",
    "name": "Tamanna Joshi",
    "rfid": "902"
  },
  {
    "sr": "2959",
    "name": "Tanish Panwar",
    "rfid": "903"
  },
  {
    "sr": "2156",
    "name": "Tanish Raghuvanshi",
    "rfid": "904"
  },
  {
    "sr": "1663",
    "name": "Tanish Rathore",
    "rfid": "905"
  },
  {
    "sr": "1671",
    "name": "Vaibhav Raghuvanshi",
    "rfid": "906"
  },
  {
    "sr": "1367",
    "name": "Vibhika Verma",
    "rfid": "907"
  },
  {
    "sr": "2217",
    "name": "Vinay Mourya",
    "rfid": "908"
  },
  {
    "sr": "3260",
    "name": "Apurv Gupta",
    "rfid": "909"
  },
  {
    "sr": "3255",
    "name": "Bajrang Saran",
    "rfid": "910"
  },
  {
    "sr": "3254",
    "name": "Dhruvkesh Bamaniya",
    "rfid": "911"
  },
  {
    "sr": "3239",
    "name": "Gautam Kelwa",
    "rfid": "912"
  },
  {
    "sr": "3250",
    "name": "Hanshika Kumawat",
    "rfid": "913"
  },
  {
    "sr": "3261",
    "name": "Lucky Saini",
    "rfid": "914"
  },
  {
    "sr": "3241",
    "name": "Pranav Patel",
    "rfid": "915"
  },
  {
    "sr": "3252",
    "name": "Pranjal Kumar",
    "rfid": "916"
  },
  {
    "sr": "3259",
    "name": "Prayag Singh",
    "rfid": "917"
  },
  {
    "sr": "3263",
    "name": "Risalat Khanam",
    "rfid": "918"
  },
  {
    "sr": "3249",
    "name": "Rishabh Sen",
    "rfid": "919"
  },
  {
    "sr": "3246",
    "name": "Sneha Malviya",
    "rfid": "920"
  },
  {
    "sr": "3244",
    "name": "Tasmiya Mansoori",
    "rfid": "921"
  },
  {
    "sr": "3243",
    "name": "Toshil Jain",
    "rfid": "922"
  },
  {
    "sr": "1849",
    "name": "Aditya Verma",
    "rfid": "923"
  },
  {
    "sr": "3092",
    "name": "Anant Baghel",
    "rfid": "924"
  },
  {
    "sr": "1328",
    "name": "Arhan Khan",
    "rfid": "925"
  },
  {
    "sr": "2622",
    "name": "Ayush Bagdiya",
    "rfid": "926"
  },
  {
    "sr": "2363",
    "name": "Deepak Shrivastav",
    "rfid": "927"
  },
  {
    "sr": "1783",
    "name": "Dhanveer Singh Chouhan",
    "rfid": "928"
  },
  {
    "sr": "3520",
    "name": "Jayant Yadav",
    "rfid": "929"
  },
  {
    "sr": "1382",
    "name": "Jigyasa Singh",
    "rfid": "930"
  },
  {
    "sr": "3519",
    "name": "Mahee Yadav",
    "rfid": "931"
  },
  {
    "sr": "2475",
    "name": "Mohammad Abdul Basit",
    "rfid": "932"
  },
  {
    "sr": "3142",
    "name": "Prathviraj Mukati",
    "rfid": "933"
  },
  {
    "sr": "1781",
    "name": "Shaurya Sampla",
    "rfid": "934"
  },
  {
    "sr": "2138",
    "name": "Shraddha Chouhan",
    "rfid": "935"
  },
  {
    "sr": "1622",
    "name": "Shubham Mishra",
    "rfid": "936"
  },
  {
    "sr": "1695",
    "name": "Utkarsh Yadav",
    "rfid": "937"
  },
  {
    "sr": "2536",
    "name": "Vaishnav Mishra",
    "rfid": "938"
  },
  {
    "sr": "3401",
    "name": "Aakruti Dixit",
    "rfid": "939"
  },
  {
    "sr": "3647",
    "name": "Abhyuday Choudhary",
    "rfid": "940"
  },
  {
    "sr": "3478",
    "name": "Aditi Dubey",
    "rfid": "941"
  },
  {
    "sr": "3674",
    "name": "Amayra Kushwah",
    "rfid": "942"
  },
  {
    "sr": "3480",
    "name": "Anushka Choudhary",
    "rfid": "943"
  },
  {
    "sr": "3416",
    "name": "Daksh Singh Chouhan",
    "rfid": "944"
  },
  {
    "sr": "3470",
    "name": "Disha Raghuvanshi",
    "rfid": "945"
  },
  {
    "sr": "3639",
    "name": "Jyanshu Mishra",
    "rfid": "946"
  },
  {
    "sr": "3632",
    "name": "Kavya Mandloi",
    "rfid": "947"
  },
  {
    "sr": "3637",
    "name": "Kushal Singh Solanki",
    "rfid": "948"
  },
  {
    "sr": "3615",
    "name": "Manvi Raghuvanshi",
    "rfid": "949"
  },
  {
    "sr": "3535",
    "name": "Punyakirti Tyagi",
    "rfid": "950"
  },
  {
    "sr": "3666",
    "name": "Purvansh Bhandari",
    "rfid": "951"
  },
  {
    "sr": "3516",
    "name": "Raghav Choudhary",
    "rfid": "952"
  },
  {
    "sr": "3508",
    "name": "Ranjan Verma",
    "rfid": "953"
  },
  {
    "sr": "3532",
    "name": "Svanik Nagar",
    "rfid": "954"
  },
  {
    "sr": "3552",
    "name": "Tanishka Yadav",
    "rfid": "955"
  },
  {
    "sr": "3490",
    "name": "Tanvika Khatri",
    "rfid": "956"
  },
  {
    "sr": "3430",
    "name": "Vedant Rathore",
    "rfid": "957"
  },
  {
    "sr": "3493",
    "name": "Veer Rai",
    "rfid": "958"
  },
  {
    "sr": "3531",
    "name": "Yuvansh Jatav",
    "rfid": "959"
  },
  {
    "sr": "3695",
    "name": "Zaira Khan",
    "rfid": "960"
  },
  {
    "sr": "3605",
    "name": "Aarohi Raghuwanshi",
    "rfid": "961"
  },
  {
    "sr": "3750",
    "name": "Aayansh Solanki",
    "rfid": "962"
  },
  {
    "sr": "3602",
    "name": "Anav Khandelwal",
    "rfid": "963"
  },
  {
    "sr": "3583",
    "name": "Anaya Sharma",
    "rfid": "964"
  },
  {
    "sr": "3656",
    "name": "Ayansh Gupta",
    "rfid": "965"
  },
  {
    "sr": "3608",
    "name": "Bhanavi Chouhan",
    "rfid": "966"
  },
  {
    "sr": "3671",
    "name": "Devansh Makwana",
    "rfid": "967"
  },
  {
    "sr": "3446",
    "name": "Divyansh Bagwan",
    "rfid": "968"
  },
  {
    "sr": "3507",
    "name": "Gauravi Patidar",
    "rfid": "969"
  },
  {
    "sr": "3556",
    "name": "Gautami Jadhav",
    "rfid": "970"
  },
  {
    "sr": "3624",
    "name": "Heer Jadhav",
    "rfid": "971"
  },
  {
    "sr": "3504",
    "name": "Hitarth Chhaparwal",
    "rfid": "972"
  },
  {
    "sr": "3522",
    "name": "Kiyansh Patidar",
    "rfid": "973"
  },
  {
    "sr": "3617",
    "name": "Krishiv Choudhary",
    "rfid": "974"
  },
  {
    "sr": "3582",
    "name": "Milind Choudhary",
    "rfid": "975"
  },
  {
    "sr": "3518",
    "name": "Naman Patel",
    "rfid": "976"
  },
  {
    "sr": "3610",
    "name": "Shivyansh Parihar",
    "rfid": "977"
  },
  {
    "sr": "3603",
    "name": "Vaibhav Jadhav",
    "rfid": "978"
  },
  {
    "sr": "3459",
    "name": "Vedansh Verma",
    "rfid": "979"
  },
  {
    "sr": "3676",
    "name": "Viraj Solanki",
    "rfid": "980"
  },
  {
    "sr": "3182",
    "name": "Vivan Singh Sisodiya",
    "rfid": "981"
  },
  {
    "sr": "3562",
    "name": "Yakshit Solanki",
    "rfid": "982"
  },
  {
    "sr": "3714",
    "name": "Aadhyashri Vaishnav",
    "rfid": "983"
  },
  {
    "sr": "3722",
    "name": "Aryamaan Singh Rathore",
    "rfid": "984"
  },
  {
    "sr": "3687",
    "name": "Chetnya Gehlod",
    "rfid": "985"
  },
  {
    "sr": "3733",
    "name": "Dhriti Mishra",
    "rfid": "986"
  },
  {
    "sr": "3759",
    "name": "Fatima Khan",
    "rfid": "987"
  },
  {
    "sr": "3689",
    "name": "Garvit Yadav",
    "rfid": "988"
  },
  {
    "sr": "3688",
    "name": "Gouranshi Gehlod",
    "rfid": "989"
  },
  {
    "sr": "3698",
    "name": "Himakshi Chaturvedi",
    "rfid": "990"
  },
  {
    "sr": "3679",
    "name": "Kartvya Joshi",
    "rfid": "991"
  },
  {
    "sr": "3700",
    "name": "Manvik Sharda",
    "rfid": "992"
  },
  {
    "sr": "3764",
    "name": "Parnika Patel",
    "rfid": "993"
  },
  {
    "sr": "3762",
    "name": "Parth Rajput",
    "rfid": "994"
  },
  {
    "sr": "3703",
    "name": "Parthavi Gandharva",
    "rfid": "995"
  },
  {
    "sr": "3753",
    "name": "Prabhnoor Kaur",
    "rfid": "996"
  },
  {
    "sr": "3692",
    "name": "Riddhish Patidar",
    "rfid": "997"
  },
  {
    "sr": "3694",
    "name": "Saanvi Singh Rajput",
    "rfid": "998"
  },
  {
    "sr": "3731",
    "name": "Shivin Raghuwanshi",
    "rfid": "999"
  },
  {
    "sr": "3675",
    "name": "Tanush Meena",
    "rfid": "1000"
  },
  {
    "sr": "3745",
    "name": "Tejashwani Chouhan",
    "rfid": "1001"
  },
  {
    "sr": "3697",
    "name": "Vaidehi Sharma",
    "rfid": "1002"
  },
  {
    "sr": "3763",
    "name": "Ved Choudhary",
    "rfid": "1003"
  },
  {
    "sr": "3717",
    "name": "Yashvardhan Chouhan",
    "rfid": "1004"
  },
  {
    "sr": "3451",
    "name": "Abuzar Patel",
    "rfid": "1005"
  },
  {
    "sr": "3453",
    "name": "Alexa Chouhan",
    "rfid": "1006"
  },
  {
    "sr": "3195",
    "name": "Anvi Rajawat",
    "rfid": "1007"
  },
  {
    "sr": "3521",
    "name": "Arun Patel",
    "rfid": "1008"
  },
  {
    "sr": "3398",
    "name": "Aviraj Chouhan",
    "rfid": "1009"
  },
  {
    "sr": "3223",
    "name": "Divyansh Singh Chouhan",
    "rfid": "1010"
  },
  {
    "sr": "3724",
    "name": "Harshvardhan Verma",
    "rfid": "1011"
  },
  {
    "sr": "3176",
    "name": "Izhaan Khan",
    "rfid": "1012"
  },
  {
    "sr": "3618",
    "name": "Jayant Choudhary",
    "rfid": "1013"
  },
  {
    "sr": "3634",
    "name": "Kashvi Chourasiya",
    "rfid": "1014"
  },
  {
    "sr": "3081",
    "name": "Kavya Jadhav",
    "rfid": "1015"
  },
  {
    "sr": "3680",
    "name": "Khush Meena",
    "rfid": "1016"
  },
  {
    "sr": "3423",
    "name": "Kunal Chhadiya",
    "rfid": "1017"
  },
  {
    "sr": "3429",
    "name": "Lakshit Singh Tanwar",
    "rfid": "1018"
  },
  {
    "sr": "3211",
    "name": "Lakshya Rathore",
    "rfid": "1019"
  },
  {
    "sr": "3433",
    "name": "Lakshyaraj Parihar",
    "rfid": "1020"
  },
  {
    "sr": "3432",
    "name": "Lavyam Jirati",
    "rfid": "1021"
  },
  {
    "sr": "3467",
    "name": "Madhav Singh",
    "rfid": "1022"
  },
  {
    "sr": "3456",
    "name": "Nawaz Khan",
    "rfid": "1023"
  },
  {
    "sr": "3704",
    "name": "Pragati Sejgaya",
    "rfid": "1024"
  },
  {
    "sr": "3667",
    "name": "Pransh Dhapiya",
    "rfid": "1025"
  },
  {
    "sr": "3170",
    "name": "Rajveer Sule",
    "rfid": "1026"
  },
  {
    "sr": "3623",
    "name": "Riya Surywanshi",
    "rfid": "1027"
  },
  {
    "sr": "3178",
    "name": "Ronak Jadhav",
    "rfid": "1028"
  },
  {
    "sr": "3690",
    "name": "Satvik Raj",
    "rfid": "1029"
  },
  {
    "sr": "3230",
    "name": "Shikha Panwar",
    "rfid": "1030"
  },
  {
    "sr": "3604",
    "name": "Shreeyansh Yadav",
    "rfid": "1031"
  },
  {
    "sr": "3187",
    "name": "Shridhi Raghuvanshi",
    "rfid": "1032"
  },
  {
    "sr": "3104",
    "name": "Urvashi Mishra",
    "rfid": "1033"
  },
  {
    "sr": "3233",
    "name": "Vaidik Kumrawat",
    "rfid": "1034"
  },
  {
    "sr": "3422",
    "name": "Vratika Chouhan",
    "rfid": "1035"
  },
  {
    "sr": "3229",
    "name": "Yuvaansh Nagar",
    "rfid": "1036"
  },
  {
    "sr": "3214",
    "name": "Akshat Sharma",
    "rfid": "1037"
  },
  {
    "sr": "3363",
    "name": "Avyukt Chhadodi",
    "rfid": "1038"
  },
  {
    "sr": "3668",
    "name": "Ayansh Parihar",
    "rfid": "1039"
  },
  {
    "sr": "3643",
    "name": "Bhanupratap Singh Sisodiya",
    "rfid": "1040"
  },
  {
    "sr": "3619",
    "name": "Devansh Singh Suner",
    "rfid": "1041"
  },
  {
    "sr": "3198",
    "name": "Hardik Sisodiya",
    "rfid": "1042"
  },
  {
    "sr": "3448",
    "name": "Harsh Panwar",
    "rfid": "1043"
  },
  {
    "sr": "3424",
    "name": "Harshita Gupta",
    "rfid": "1044"
  },
  {
    "sr": "3457",
    "name": "Hetik Chandel",
    "rfid": "1045"
  },
  {
    "sr": "3179",
    "name": "Himanshu Choudhary",
    "rfid": "1046"
  },
  {
    "sr": "3616",
    "name": "Jhilmil",
    "rfid": "1047"
  },
  {
    "sr": "3351",
    "name": "Kartik Jogee",
    "rfid": "1048"
  },
  {
    "sr": "3172",
    "name": "Kashvi Bairagi",
    "rfid": "1049"
  },
  {
    "sr": "3353",
    "name": "Krimansh Makwana",
    "rfid": "1050"
  },
  {
    "sr": "3686",
    "name": "Kushagra Sajankar",
    "rfid": "1051"
  },
  {
    "sr": "3431",
    "name": "Mahir Rathore",
    "rfid": "1052"
  },
  {
    "sr": "3465",
    "name": "Miraya Yadav",
    "rfid": "1053"
  },
  {
    "sr": "3681",
    "name": "Pranvi Patidar",
    "rfid": "1054"
  },
  {
    "sr": "3188",
    "name": "Prisha Dhiraj",
    "rfid": "1055"
  },
  {
    "sr": "3677",
    "name": "Riyanshi Nishad",
    "rfid": "1056"
  },
  {
    "sr": "3425",
    "name": "Riyant Raghuvanshi",
    "rfid": "1057"
  },
  {
    "sr": "3710",
    "name": "Rudraditya Jat",
    "rfid": "1058"
  },
  {
    "sr": "3180",
    "name": "Sakshi Bagwan",
    "rfid": "1059"
  },
  {
    "sr": "3658",
    "name": "Sarav Panwar",
    "rfid": "1060"
  },
  {
    "sr": "3441",
    "name": "Shrit Choudhary",
    "rfid": "1061"
  },
  {
    "sr": "3436",
    "name": "Tabish Khan",
    "rfid": "1062"
  },
  {
    "sr": "3344",
    "name": "Tanvi",
    "rfid": "1063"
  },
  {
    "sr": "3728",
    "name": "Tanvi Rajput",
    "rfid": "1064"
  },
  {
    "sr": "3205",
    "name": "Tejal Tanwar",
    "rfid": "1065"
  },
  {
    "sr": "3352",
    "name": "Trisha Yadav",
    "rfid": "1066"
  },
  {
    "sr": "3362",
    "name": "Vaidhika Choudhary",
    "rfid": "1067"
  },
  {
    "sr": "3636",
    "name": "Vihana Gathe",
    "rfid": "1068"
  }
]

school = School.objects.filter(name__icontains="South Valley").first()
if not school:
    school_id = 19
else:
    school_id = school.id

print(f"Target School ID: {school_id} ({getattr(school, 'name', 'South Valley')})")

svis_students = list(StudentProfile.objects.filter(school_id=school_id).select_related('user'))
by_adm = {str(sp.admission_number).strip(): sp for sp in svis_students if sp.admission_number}
by_name = {(sp.user.get_full_name().strip().lower() if sp.user else f"{sp.first_name} {sp.last_name}".strip().lower()): sp for sp in svis_students}

to_update = []
updated_count = 0
already_correct = 0
not_found = 0

for item in records:
    sr = item['sr']
    name = item['name']
    rfid = item['rfid']
    
    student = None
    if sr and sr in by_adm:
        student = by_adm[sr]
    elif name.lower() in by_name:
        student = by_name[name.lower()]
        
    if not student:
        not_found += 1
        continue
        
    if student.rfid_code != rfid:
        student.rfid_code = rfid
        to_update.append(student)
        updated_count += 1
    else:
        already_correct += 1

if to_update:
    with transaction.atomic():
        StudentProfile.objects.bulk_update(to_update, ['rfid_code'], batch_size=200)
    print(f"SUCCESS: Bulk updated {len(to_update)} student RFID records on EC2 Postgres DB!")
else:
    print(f"ALL GOOD: All {already_correct} student RFID records were already up to date on EC2!")

print(f"Summary -> Total: {len(records)}, Updated: {updated_count}, Already Correct: {already_correct}, Not Found: {not_found}")
