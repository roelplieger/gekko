cd /home/roel/gekko_roel

cp strtrade.log t1_str.txt


diff=$(diff t1_str.txt t2_str.txt | grep -E 'BUY|SELL' | sed ':a;N;$!ba;s/\n/\\n/g' | sed 's/< //g' | sed 's/\t\t //g' | sed 's/\t/\\t/g' | sed 's/(INFO)://g' | sed 's/(DEBUG)://g')
json="{ \"value1\": \"\\n"$diff"\" }"

#echo "$json"

if [ ! -z "$diff" ]
then curl -d "$json" -H "Content-Type: application/json" -X POST https://maker.ifttt.com/trigger/gekko_trade/with/key/crGyrAaBfn-9QlmvVvDx_w
fi

cp t1_str.txt t2_str.txt


