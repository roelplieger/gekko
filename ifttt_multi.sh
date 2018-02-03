cd /home/roel/gekko_roel

cp $1trade.log t1_$1.txt


diff=$(diff t1_$1.txt t2_$1.txt | grep -E 'BUY|SELL|PROFIT|price|rsi' | awk '{print substr($0, 23);}' | sed ':a;N;$!ba;s/\n/\\n/g' | sed 's/< //g' | sed 's/\t\t //g' | sed 's/\t/\\t/g' | sed 's/(INFO)://g' | sed 's/(DEBUG)://g')
json="{ \"value1\": \"\\n$1:\\n"$diff"\" }"

#echo "$json"

if [ ! -z "$diff" ]
then curl -d "$json" -H "Content-Type: application/json" -X POST https://maker.ifttt.com/trigger/gekko_trade/with/key/crGyrAaBfn-9QlmvVvDx_w
fi

cp t1_$1.txt t2_$1.txt


